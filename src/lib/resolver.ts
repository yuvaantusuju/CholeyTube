import { createClient, describeAxiosError } from "./http";
import { buildFormatLadder } from "./formats";
import { resolveWithYtdlp, ytdlpAvailable } from "./ytdlp";
import type { MediaFormat, ResolveMode } from "./types";

/**
 * Download-link resolution layer.
 * ------------------------------------------------------------------
 * CholeyTube keeps extraction behind a swappable adapter so the UI/API never
 * depend on one upstream provider.
 *
 * `RESOLVER_ENDPOINT`  – optional HTTP service you control (for example a
 *                        self-hosted yt-dlp / y2mate-compatible worker). When
 *                        set, CholeyTube POSTs `{ videoId, url }` to it and
 *                        expects `{ formats: [{ id, url, sizeBytes }] }` back.
 * `RESOLVER_REFERENCE_HOST` – the reference host shown in the UI (defaults to
 *                        the y2mate mirror named in the project brief).
 *
 * With no endpoint configured the API answers in **preview mode**: real
 * metadata, real quality ladder, estimated file sizes, and inert links. That
 * keeps the product demo-able without shipping an extractor that bypasses
 * YouTube's own delivery/DRM protections, which would break their Terms of
 * Service (and most rights-holders' licences).
 */

export const REFERENCE_HOST =
  process.env.RESOLVER_REFERENCE_HOST ?? "https://v33.www-y2mate.com";

const PREVIEW_NOTE =
  "Preview mode — no extraction backend attached. Run the bundled sidecar " +
  "(node resolver/server.mjs) and set RESOLVER_ENDPOINT to enable real downloads.";

export interface ResolveOutput {
  mode: ResolveMode;
  formats: MediaFormat[];
  notice: string | null;
  resolverHost: string;
}

interface ResolverResponse {
  formats?: Array<{
    id?: string;
    quality?: string;
    kind?: string;
    url?: string;
    sizeBytes?: number | string | null;
  }>;
  error?: string;
}

export async function resolveDownloads(
  videoId: string,
  watchUrl: string,
  durationSeconds: number | null,
  title = "choleytube",
): Promise<ResolveOutput> {
  const endpoint = process.env.RESOLVER_ENDPOINT?.trim();

  // ---- Local extraction (yt-dlp on this machine) ------------------------
  // Preferred when available: no sidecar, no third-party mirror.
  if (!endpoint && (await ytdlpAvailable())) {
    try {
      const local = await resolveWithYtdlp(watchUrl);
      const count = Object.keys(local.links).length + Object.keys(local.muxPairs).length;

      if (count > 0) {
        return {
          mode: "live",
          resolverHost: "local · yt-dlp",
          notice:
            count < 7
              ? "Some rungs are unavailable — hover a locked row for the exact reason."
              : null,
          formats: buildFormatLadder({
            videoId,
            durationSeconds: durationSeconds ?? local.durationSeconds,
            links: local.links,
            muxLinks: local.muxPairs,
            notes: local.notes,
            title,
          }),
        };
      }

      // Extraction worked but every URL was refused — almost always because
      // this server sits in a datacenter IP range that Google blocks.
      return {
        mode: "preview",
        resolverHost: "local · yt-dlp",
        notice:
          "Extraction succeeded, but YouTube refused every media URL for this server's IP (HTTP 403). " +
          "Google blocks media delivery to most cloud/datacenter ranges. Run CholeyTube on a home/residential " +
          "connection and these links populate automatically.",
        formats: buildFormatLadder({
          videoId,
          durationSeconds: durationSeconds ?? local.durationSeconds,
          notes: local.notes,
          title,
          note: "Blocked for this server's IP",
        }),
      };
    } catch (error) {
      return degraded(
        videoId,
        durationSeconds,
        `Local extraction failed: ${error instanceof Error ? error.message.split("\n")[0] : "unknown error"}.`,
        "local · yt-dlp",
        title,
      );
    }
  }

  if (!endpoint) {
    return {
      mode: "preview",
      resolverHost: hostOf(REFERENCE_HOST),
      notice: PREVIEW_NOTE,
      formats: buildFormatLadder({
        videoId,
        durationSeconds,
        title,
        note: "Link unavailable in preview mode",
      }),
    };
  }

  try {
    const client = createClient(undefined, REFERENCE_HOST);
    const res = await client.post<ResolverResponse>(
      endpoint,
      { videoId, url: watchUrl },
      {
        headers: process.env.RESOLVER_TOKEN
          ? { Authorization: `Bearer ${process.env.RESOLVER_TOKEN}` }
          : undefined,
      },
    );

    if (res.status < 200 || res.status >= 300) {
      return degraded(
        videoId,
        durationSeconds,
        `Resolver responded with ${res.status}.`,
        endpoint,
        title,
      );
    }

    const links: Record<string, { url: string; sizeBytes?: number | null }> = {};
    for (const entry of res.data?.formats ?? []) {
      const id = normaliseId(entry.id ?? entry.quality ?? "", entry.kind);
      if (!id || !entry.url || !/^https?:\/\//i.test(entry.url)) continue;
      const size = typeof entry.sizeBytes === "string" ? Number(entry.sizeBytes) : entry.sizeBytes;
      links[id] = { url: entry.url, sizeBytes: Number.isFinite(size) ? (size as number) : null };
    }

    if (Object.keys(links).length === 0) {
      return degraded(
        videoId,
        durationSeconds,
        "Resolver returned no usable links for this video.",
        endpoint,
        title,
      );
    }

    return {
      mode: "live",
      resolverHost: hostOf(endpoint),
      notice: null,
      formats: buildFormatLadder({
        videoId,
        durationSeconds,
        links,
        title,
        note: "Not offered for this video",
      }),
    };
  } catch (error) {
    return degraded(videoId, durationSeconds, describeAxiosError(error), endpoint, title);
  }
}

function degraded(
  videoId: string,
  durationSeconds: number | null,
  reason: string,
  endpoint: string,
  title: string,
): ResolveOutput {
  return {
    mode: "preview",
    resolverHost: hostOf(endpoint),
    notice: `${reason} Showing estimated sizes only.`,
    formats: buildFormatLadder({
      videoId,
      durationSeconds,
      title,
      note: "Link unavailable",
    }),
  };
}

/** Accepts "1080p", "mp4-1080", "320kbps", "mp3-320"… → canonical ladder id. */
function normaliseId(raw: string, kind?: string): string | null {
  const value = raw.toLowerCase().trim();
  if (!value) return null;
  if (/^mp4-\d{3,4}$/.test(value) || /^mp3-\d{2,3}$/.test(value)) return value;

  const height = /^(\d{3,4})p$/.exec(value);
  if (height) return `mp4-${height[1]}`;

  const bitrate = /^(\d{2,3})\s?kbps$/.exec(value);
  if (bitrate) return `mp3-${bitrate[1]}`;

  if (kind === "audio" && /^\d{2,3}$/.test(value)) return `mp3-${value}`;
  if (kind === "video" && /^\d{3,4}$/.test(value)) return `mp4-${value}`;
  return null;
}

function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
