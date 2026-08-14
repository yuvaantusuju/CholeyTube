import { NextRequest, NextResponse } from "next/server";
// execa v5 is CJS; use default import
import execa from "execa";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";

// yt-dlp binary bundled with yt-dlp-exec. Resolved at call time.
function getYtDlpPath(): string {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    "yt-dlp-exec",
    "bin",
    "yt-dlp"
  );
}

export const dynamic = "force-dynamic";
// Next.js default serverless timeout may be short; buffer large downloads.
export const maxDuration = 300;

type Mode = "mp3" | "mp4";

interface DownloadPayload {
  url: string;
  mode: Mode;
  quality?: string; // for mp3: "128" | "192" | "320"
  resolution?: string; // for mp4: "360" | "480" | "720" | "1080" | "2160"
  embedThumbnail?: boolean;
}

const FFMPEG_PATH = "/usr/bin/ffmpeg";

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "download";
}

function isValidYtUrl(u: string): boolean {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/.+/i.test(u);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "choley-"));
  let outputFile: string | null = null;

  try {
    const body = (await req.json()) as DownloadPayload;
    const url = body.url?.trim();
    const mode: Mode = body.mode === "mp4" ? "mp4" : "mp3";

    if (!url || !isValidYtUrl(url)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL." },
        { status: 400 }
      );
    }

    // Fetch title first for a clean filename
    const meta = await execa(
      getYtDlpPath(),
      [
        url,
        "--dump-single-json",
        "--skip-download",
        "--no-warnings",
        "--no-check-certificates",
      ],
      { timeout: 30_000 }
    );

    let title = "download";
    let isPlaylist = false;
    try {
      const parsed = JSON.parse(meta.stdout || "{}");
      isPlaylist = parsed?._type === "playlist";
      title =
        parsed?.title ||
        parsed?.fulltitle ||
        (isPlaylist ? "youtube-playlist" : "youtube-audio");
    } catch {
      title = "youtube-audio";
    }

    if (isPlaylist) {
      return NextResponse.json(
        {
          error:
            "Playlist download is disabled for now. Please provide a single video URL.",
        },
        { status: 400 }
      );
    }

    const outTemplate = path.join(tmpDir, "out.%(ext)s");

    const args: string[] = [
      url,
      "--no-warnings",
      "--no-check-certificates",
      "--no-playlist",
      "--output",
      outTemplate,
      "--ffmpeg-location",
      FFMPEG_PATH,
    ];

    const safeTitle = sanitizeFilename(title);

    if (mode === "mp3") {
      const bitrate =
        body.quality === "320" ? "320K" :
        body.quality === "192" ? "192K" : "128K";
      args.push(
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        bitrate
      );
      if (body.embedThumbnail !== false) {
        args.push("--embed-thumbnail", "--add-metadata");
      }
      // Ensure ID3v2.3 tags for broad player compatibility
      args.push(
        "--postprocessor-args",
        "ExtractAudio:-id3v2_version 3"
      );
    } else {
      const height =
        body.resolution === "2160" ? 2160 :
        body.resolution === "1080" ? 1080 :
        body.resolution === "720" ? 720 :
        body.resolution === "480" ? 480 : 360;
      args.push(
        "--format",
        `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`,
        "--merge-output-format",
        "mp4",
        "--embed-thumbnail",
        "--add-metadata"
      );
    }

    const proc = execa(getYtDlpPath(), args, {
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });

    // Pipe stderr for debugging but don't spam
    proc.stderr?.on("data", () => {
      // Swallow chunks; if needed we could wire to server logs
    });

    await proc;

    // Find output file (yt-dlp produces out.mp3 or out.mp4 etc.)
    const expectedExt = mode === "mp3" ? "mp3" : "mp4";
    const directCandidate = path.join(tmpDir, `out.${expectedExt}`);

    if (await pathExists(directCandidate)) {
      outputFile = directCandidate;
    } else {
      // Fallback: find any file in tmp
      const files = await fs.readdir(tmpDir);
      const media = files.find((f) => {
        const ext = path.extname(f).toLowerCase().slice(1);
        if (mode === "mp3") return ext === "mp3";
        return ["mp4", "mkv", "webm"].includes(ext);
      });
      if (!media) {
        return NextResponse.json(
          { error: "Download completed but output file not found." },
          { status: 500 }
        );
      }
      outputFile = path.join(tmpDir, media);
    }

    const finalName = `${safeTitle}.${expectedExt}`;

    const stat = await fs.stat(outputFile);
    const fileStream = fsSync.createReadStream(outputFile);

    // We must return the file and clean up after. Use a ReadableStream wrapper.
    const cleanStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk as Buffer));
        fileStream.on("end", () => {
          controller.close();
          // Best-effort cleanup
          fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        });
        fileStream.on("error", (err) => {
          try { controller.error(err); } catch {}
          fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        });
      },
      cancel() {
        fileStream.destroy();
        fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      },
    });

    return new NextResponse(cleanStream, {
      status: 200,
      headers: {
        "Content-Type": mode === "mp3" ? "audio/mpeg" : "video/mp4",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(finalName)}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: unknown) {
    console.error("[download] error:", err);
    // Cleanup temp
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    const message = err instanceof Error ? err.message : "Unknown download error";
    return NextResponse.json(
      { error: `Download/conversion failed: ${message.slice(0, 500)}` },
      { status: 500 }
    );
  }
}
