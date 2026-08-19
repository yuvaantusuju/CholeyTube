import { NextResponse, type NextRequest } from "next/server";

import { cacheGet, cacheSet, rateLimit } from "@/lib/cache";
import { MetadataError, fetchVideoMetadata } from "@/lib/metadata";
import { REFERENCE_HOST, resolveDownloads } from "@/lib/resolver";
import { SAMPLE_ASSETS, SAMPLE_CREDIT } from "@/lib/samples";
import { buildMuxUrl, buildProxyUrl } from "@/lib/sign";
import { ffmpegAvailable } from "@/lib/ytdlp";
import type { ApiErrorCode, ApiResponse, SampleDownload, VideoResult } from "@/lib/types";
import { formatDuration, parseYouTubeUrl } from "@/lib/youtube";

/**
 * Openly-licensed files the proxy is always allowed to serve. These let a user
 * confirm the download path works even before a resolver is attached.
 */
async function buildSampleDownloads(): Promise<SampleDownload[]> {
  // The merged sample spawns ffmpeg; hide it when the binary isn't present so
  // we never render a Download button that cannot work.
  const canMux = await ffmpegAvailable();
  const assets = SAMPLE_ASSETS.filter((asset) => !asset.audioUrl || canMux);

  return assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    label: asset.label,
    description: asset.description,
    container: asset.container,
    proxyUrl: asset.audioUrl
      ? buildMuxUrl(asset.url, asset.audioUrl, `big-buck-bunny-${asset.label}.${asset.container}`)
      : buildProxyUrl(asset.url, `big-buck-bunny-${asset.label}.${asset.container}`),
    credit: SAMPLE_CREDIT,
  }));
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60_000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(body: ApiResponse, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...extra },
  });
}

function fail(code: ApiErrorCode, message: string, status: number, hint?: string) {
  return json({ ok: false, error: { code, message, hint } }, status);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Small capability probe — handy for uptime checks and for the footer badge. */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "CholeyTube resolve API",
      referenceHost: REFERENCE_HOST,
      mode: process.env.RESOLVER_ENDPOINT ? "live" : "preview",
      accepts: { method: "POST", body: { url: "https://youtu.be/<id>" } },
    },
    { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  // ---- 1. Rate limiting -------------------------------------------------
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";
  const limit = rateLimit(`resolve:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Give it a few seconds and try again.",
          hint: `Retry in ${limit.retryAfterSeconds}s.`,
        },
      },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  // ---- 2. Body parsing --------------------------------------------------
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Request body must be valid JSON.", 400);
  }

  const rawUrl =
    typeof payload === "object" && payload !== null && "url" in payload
      ? String((payload as { url: unknown }).url ?? "")
      : "";

  // ---- 3. URL validation ------------------------------------------------
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed.ok) {
    return fail(parsed.code, parsed.message, parsed.code === "EMPTY_INPUT" ? 400 : 422, {
      EMPTY_INPUT: "Try https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      INVALID_URL: "Copy the link straight from the YouTube share sheet.",
      NOT_YOUTUBE: "Playlists, channels and other sites are not supported.",
    }[parsed.code]);
  }

  const { videoId, watchUrl } = parsed;

  // ---- 4. Cache ---------------------------------------------------------
  const cached = cacheGet<VideoResult>(`video:${videoId}`);
  if (cached) {
    return json(
      { ok: true, data: { ...cached, cached: true, elapsedMs: Date.now() - startedAt } },
      200,
    );
  }

  // ---- 5. Metadata + link resolution ------------------------------------
  try {
    const metadata = await fetchVideoMetadata(videoId);
    const resolved = await resolveDownloads(
      videoId,
      watchUrl,
      metadata.durationSeconds,
      metadata.title,
    );

    const result: VideoResult = {
      videoId,
      title: metadata.title,
      channel: metadata.channel,
      channelUrl: metadata.channelUrl,
      thumbnail: metadata.thumbnail,
      durationSeconds: metadata.durationSeconds,
      durationLabel: formatDuration(metadata.durationSeconds),
      watchUrl,
      metadataSource: metadata.source,
      degraded: metadata.degraded,
      mode: resolved.mode,
      resolverHost: resolved.resolverHost,
      notice: [metadata.degradedReason, resolved.notice].filter(Boolean).join(" ") || null,
      formats: resolved.formats,
      samples: resolved.formats.some((f) => !f.available) ? await buildSampleDownloads() : [],
      cached: false,
      fetchedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
    };

    cacheSet(`video:${videoId}`, result, CACHE_TTL_MS);
    return json({ ok: true, data: result }, 200);
  } catch (error) {
    if (error instanceof MetadataError) {
      return fail(
        error.code,
        error.message,
        error.code === "VIDEO_UNAVAILABLE" ? 404 : 502,
        "Double-check the link opens in a normal browser tab.",
      );
    }

    console.error("[/api/download] unexpected failure", error);
    return fail("INTERNAL_ERROR", "Something broke while analysing that link.", 500);
  }
}
