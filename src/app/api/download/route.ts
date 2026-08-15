// Node.js runtime (default) — same reason as metadata/route.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// IMPORTANT: switching to the Node.js runtime does NOT give you a real
// filesystem or the ability to spawn OS processes. @opennextjs/cloudflare
// still deploys this to Cloudflare Workers under the hood — it just
// polyfills far more of Node's *API surface* (stream, crypto, events,
// buffer) than the edge runtime does. child_process, fs writes, and a
// system ffmpeg binary are still unavailable. That's why this route still
// avoids execa/yt-dlp-exec/fluent-ffmpeg entirely and streams directly
// from ytdl-core, same as before.

import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import ytdl from "@distube/ytdl-core";

type Mode = "mp3" | "mp4";

interface DownloadPayload {
  url: string;
  mode: Mode;
  quality?: string; // for mp3: "128" | "192" | "320" (best-effort match, no re-encode here)
  resolution?: string; // for mp4: "360" | "480" | "720" | "1080" | "2160"
}

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "download"
  );
}

function toWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream {
  return Readable.toWeb(nodeStream as Readable) as unknown as ReadableStream;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DownloadPayload;
    const url = body.url?.trim();
    const mode: Mode = body.mode === "mp4" ? "mp4" : "mp3";

    if (!url || !ytdl.validateURL(url)) {
      return NextResponse.json({ error: "Invalid YouTube URL." }, { status: 400 });
    }

    const info = await ytdl.getInfo(url);

    if (info.videoDetails.isLiveContent) {
      return NextResponse.json(
        { error: "Live streams aren't supported." },
        { status: 400 }
      );
    }

    const safeTitle = sanitizeFilename(
      info.videoDetails.title || (mode === "mp3" ? "youtube-audio" : "youtube-video")
    );

    if (mode === "mp3") {
      // Raw audio-only stream — real re-encoding to .mp3 still needs to
      // happen client-side with @ffmpeg/ffmpeg, since there's no ffmpeg
      // binary here even under the Node.js runtime.
      const audioFormats = ytdl.filterFormats(info.formats, "audioonly");
      if (audioFormats.length === 0) {
        return NextResponse.json(
          { error: "No audio-only stream available for this video." },
          { status: 500 }
        );
      }

      const targetKbps =
        body.quality === "320" ? 320 : body.quality === "192" ? 192 : 128;

      const bestAudio =
        audioFormats
          .filter((f) => typeof f.audioBitrate === "number")
          .sort((a, b) => {
            const da = Math.abs((a.audioBitrate ?? 0) - targetKbps);
            const db = Math.abs((b.audioBitrate ?? 0) - targetKbps);
            return da - db;
          })[0] ?? audioFormats[0];

      const nodeStream = ytdl.downloadFromInfo(info, { format: bestAudio });
      const container = bestAudio.container || "webm";

      return new NextResponse(toWebStream(nodeStream), {
        status: 200,
        headers: {
          "Content-Type":
            bestAudio.mimeType?.split(";")[0] || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(
            `${safeTitle}.${container}`
          )}"`,
          "X-Needs-Client-Transcode": "mp3",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // mode === "mp4"
    const requestedHeight =
      body.resolution === "2160"
        ? 2160
        : body.resolution === "1080"
        ? 1080
        : body.resolution === "720"
        ? 720
        : body.resolution === "480"
        ? 480
        : 360;

    // Progressive (video+audio combined) mp4 formats top out at 720p on
    // YouTube; higher resolutions need muxing, which needs ffmpeg — still
    // not available here.
    const progressiveFormats = ytdl
      .filterFormats(info.formats, "videoandaudio")
      .filter((f) => f.container === "mp4");

    if (progressiveFormats.length === 0) {
      return NextResponse.json(
        { error: "No combined video+audio mp4 stream available for this video." },
        { status: 500 }
      );
    }

    const capped = Math.min(requestedHeight, 720);
    const chosen =
      progressiveFormats
        .filter((f) => (f.height ?? 0) <= capped)
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0] ??
      progressiveFormats.sort((a, b) => (a.height ?? 0) - (b.height ?? 0))[0];

    const nodeStream = ytdl.downloadFromInfo(info, { format: chosen });

    const res = new NextResponse(toWebStream(nodeStream), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          `${safeTitle}.mp4`
        )}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });

    if (requestedHeight > 720) {
      res.headers.set(
        "X-Resolution-Capped",
        `Requested ${requestedHeight}p; served ${
          chosen.height ?? "unknown"
        }p (720p is the highest progressive mp4 available without server-side muxing).`
      );
    }

    return res;
  } catch (err: unknown) {
    console.error("[download] error:", err);
    const message = err instanceof Error ? err.message : "Unknown download error";
    return NextResponse.json(
      { error: `Download failed: ${message.slice(0, 500)}` },
      { status: 500 }
    );
  }
}