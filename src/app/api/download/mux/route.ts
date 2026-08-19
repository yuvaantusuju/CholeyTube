import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { NextResponse, type NextRequest } from "next/server";

import { BROWSER_UA } from "@/lib/http";
import { b64urlDecode, verify } from "@/lib/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * On-the-fly muxer.
 *
 * YouTube publishes its higher resolutions as *separate* video-only and
 * audio-only tracks, so 1080p/720p/480p cannot be saved as a single file
 * without recombining them. This route streams both tracks through ffmpeg
 * with `-c copy` (no re-encoding, so it is fast and lossless) and returns one
 * fragmented MP4 as an attachment.
 *
 * Two implementation notes:
 *  - ffmpeg fetches nothing itself. Static builds frequently segfault on their
 *    own TLS stack, so Node performs both HTTP fetches and feeds ffmpeg.
 *  - The video track arrives on stdin and the (much smaller) audio track is
 *    buffered to a temp file, because ffmpeg can only accept one stdin.
 */

const BLOCKED_HOST =
  /^(localhost|0\.0\.0\.0|\[?::1\]?|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

function bad(message: string, status: number) {
  return NextResponse.json({ ok: false, error: { message } }, { status });
}

function safeUrl(encoded: string): URL | null {
  try {
    const url = new URL(b64urlDecode(encoded));
    if (!/^https?:$/.test(url.protocol) || BLOCKED_HOST.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const v = params.get("v");
  const a = params.get("a");
  const signature = params.get("s");
  const fileName = sanitiseFileName(params.get("n") ?? "choleytube-download.mp4");

  if (!v || !a || !signature) return bad("Missing signed mux parameters.", 400);
  if (!verify(`${v}.${a}`, signature)) return bad("Invalid mux signature.", 403);

  const videoUrl = safeUrl(v);
  const audioUrl = safeUrl(a);
  if (!videoUrl || !audioUrl) return bad("Target host is not permitted.", 403);

  const headers = {
    "User-Agent": BROWSER_UA,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  // ---- Fetch both tracks ------------------------------------------------
  let videoRes: Response;
  let audioRes: Response;
  try {
    [videoRes, audioRes] = await Promise.all([
      fetch(videoUrl, { headers, redirect: "follow", cache: "no-store" }),
      fetch(audioUrl, { headers, redirect: "follow", cache: "no-store" }),
    ]);
  } catch {
    return bad("Could not reach the media host.", 502);
  }

  if (!videoRes.ok || !audioRes.ok) {
    const status = !videoRes.ok ? videoRes.status : audioRes.status;
    await Promise.all([
      videoRes.body?.cancel().catch(() => undefined),
      audioRes.body?.cancel().catch(() => undefined),
    ]);
    return bad(
      status === 403
        ? "YouTube refused this transfer (403). Media URLs are bound to the extracting IP, and " +
            "Google blocks delivery to most cloud/datacenter ranges."
        : `Media host responded with ${status}.`,
      502,
    );
  }

  if (!videoRes.body || !audioRes.body) return bad("Empty media response.", 502);

  // ---- Buffer the audio track (small) to a temp file --------------------
  let workDir: string;
  try {
    workDir = await mkdtemp(join(tmpdir(), "choley-"));
  } catch {
    return bad("Could not allocate temporary storage.", 500);
  }

  const audioPath = join(workDir, "audio.m4a");
  const cleanup = () => void rm(workDir, { recursive: true, force: true }).catch(() => undefined);

  try {
    await pipeline(Readable.fromWeb(audioRes.body as never), createWriteStream(audioPath));
  } catch {
    cleanup();
    return bad("Failed while buffering the audio track.", 502);
  }

  // ---- Mux ---------------------------------------------------------------
  const ffmpeg = spawn(
    FFMPEG,
    [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-i", audioPath,
      "-map", "0:v:0",
      "-map", "1:a:0?",
      "-c", "copy",
      // Fragmented MP4: required because stdout is not seekable.
      "-movflags", "frag_keyframe+empty_moov+default_base_moof",
      "-f", "mp4",
      "pipe:1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  let stderr = "";
  ffmpeg.stderr.on("data", (chunk) => {
    if (stderr.length < 4000) stderr += String(chunk);
  });

  ffmpeg.on("error", () => cleanup());
  ffmpeg.on("close", (code) => {
    if (code !== 0 && stderr) console.error("[mux] ffmpeg failed:", stderr.slice(0, 500));
    cleanup();
  });

  // Feed the video track in. EPIPE is expected if the client aborts.
  pipeline(Readable.fromWeb(videoRes.body as never), ffmpeg.stdin).catch(() => {
    ffmpeg.kill("SIGKILL");
  });

  // Stop transcoding as soon as the client goes away.
  request.signal.addEventListener("abort", () => ffmpeg.kill("SIGKILL"));

  return new NextResponse(Readable.toWeb(ffmpeg.stdout) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": contentDisposition(fileName),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sanitiseFileName(raw: string): string {
  const cleaned = raw
    .replace(/[/\\?%*:|"<>\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "choleytube-download.mp4";
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
