import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import path from "node:path";
import fs from "node:fs";
import {
  buildFormatSelector,
  getFfmpegPath,
  isSupportedUrl,
  safeFilename,
} from "@/lib/ytdlp";
import { getDb } from "@/db";
import { downloads } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveBinary(): string {
  const candidates = [
    path.join(
      /* turbopack-ignore */ process.cwd(),
      "node_modules",
      "youtube-dl-exec",
      "bin",
      process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
    ),
    "yt-dlp",
  ];
  for (const c of candidates) {
    if (c === "yt-dlp") return c;
    if (fs.existsSync(c)) return c;
  }
  return "yt-dlp";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = (searchParams.get("url") ?? "").trim();
  const formatId = (searchParams.get("format") ?? "").trim() || "best";
  const kind = (searchParams.get("kind") ?? "video") as "video" | "audio" | "video-only" | "audio-only";
  const heightParam = searchParams.get("height");
  const height = heightParam ? Number(heightParam) || undefined : undefined;
  const title = (searchParams.get("title") ?? "choleytube").trim();

  if (!url || !isSupportedUrl(url)) {
    return NextResponse.json({ error: "Invalid or missing URL." }, { status: 400 });
  }

  const { format, mergeOutputFormat } = buildFormatSelector({
    url,
    formatId,
    kind,
    height,
    title,
  });

  // Best-effort audit log. Never block the response on a DB write.
  try {
    const db = getDb();
    if (db) {
      void db.insert(downloads).values({
        url,
        title,
        formatId,
        formatKind: kind,
        height: height ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
        ip:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          req.headers.get("x-real-ip") ??
          null,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[audit log] failed:", err);
  }

  const ext = kind === "audio" || formatId === "mp3" ? "mp3" : "mp4";
  const filename = safeFilename(title, ext);
  const ffmpeg = getFfmpegPath();

  const args = [
    url,
    "--no-check-certificates",
    "--no-warnings",
    "--no-part",
    "--no-playlist",
    "-f", format,
    ...(mergeOutputFormat ? ["--merge-output-format", mergeOutputFormat] : []),
    ...(ffmpeg ? ["--ffmpeg-location", ffmpeg] : []),
    "-o", "-",
  ];

  const binary = resolveBinary();
  const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });

  child.stderr.on("data", (chunk) => {
    const s = chunk.toString();
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(`[yt-dlp] ${s}`);
    }
  });

  child.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[yt-dlp spawn error]", err);
  });

  // Kill the child if the client disconnects mid-download.
  req.signal.addEventListener("abort", () => {
    if (!child.killed) child.kill("SIGTERM");
  });

  const webStream = Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>;

  const headers = new Headers({
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Content-Type": ext === "mp3" ? "audio/mpeg" : "video/mp4",
    "Cache-Control": "no-store",
  });

  return new NextResponse(webStream, { headers });
}
