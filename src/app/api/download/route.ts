import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import {
  FFMPEG_PATH,
  FFPROBE_PATH,
  fetchVideoInfo,
  findFile,
  friendlyError,
  invokeYtDlp,
  invokeYtDlpWithFallback,
  isYouTubeUrl,
  mp4FormatSelector,
  sanitizeFilename,
} from "@/lib/youtube";
import type { VideoInfo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Point fluent-ffmpeg at the bundled static binaries so no system FFmpeg is
// required to run the conversion pipeline.
if (FFMPEG_PATH) {
  try {
    ffmpeg.setFfmpegPath(FFMPEG_PATH);
  } catch {
    /* ignore */
  }
}
try {
  ffmpeg.setFfprobePath(FFPROBE_PATH);
} catch {
  /* ignore */
}

const MP3_BITRATES = new Set(["128", "192", "320"]);
const MP4_RESOLUTIONS = new Set(["360", "480", "720", "1080", "2160"]);

const BASE_DOWNLOAD_FLAGS = {
  noPlaylist: true,
  noWarnings: true,
  noCheckCertificates: true,
  quiet: true,
  noProgress: true,
  ...(FFMPEG_PATH ? { ffmpegLocation: FFMPEG_PATH } : {}),
};

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const url = (params.get("url") ?? "").trim();
  const type = params.get("type") === "mp4" ? "mp4" : "mp3";
  const rawQuality = (params.get("quality") ?? "").trim();
  const embedThumbnail = params.get("embedThumbnail") === "1";

  if (!url || !isYouTubeUrl(url)) {
    return Response.json(
      { error: "Please provide a valid YouTube URL." },
      { status: 400 },
    );
  }

  if (type === "mp3" && !FFMPEG_PATH) {
    return Response.json(
      { error: "FFmpeg is not available on this server, so audio conversion can't run." },
      { status: 500 },
    );
  }

  const quality =
    type === "mp3"
      ? MP3_BITRATES.has(rawQuality)
        ? rawQuality
        : "192"
      : MP4_RESOLUTIONS.has(rawQuality)
        ? rawQuality
        : "720";

  let workDir: string | null = null;

  try {
    // Resolve metadata first so we can use a clean, title-based filename and
    // transparently handle playlist URLs (we download the first entry).
    const info = await fetchVideoInfo(url);
    const downloadUrl = info.webpageUrl || url;
    const extension = type === "mp3" ? "mp3" : "mp4";
    const fileName = `${sanitizeFilename(info.title)}.${extension}`;

    workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "cholytube-"));

    const outputPath =
      type === "mp3"
        ? await processMp3({ downloadUrl, info, quality, embedThumbnail, workDir })
        : await processMp4({ downloadUrl, info, quality, workDir });

    return streamFile(outputPath, fileName, type);
  } catch (err) {
    if (workDir) {
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
    return Response.json({ error: friendlyError(err) }, { status: 422 });
  }
}

/**
 * MP3 pipeline:
 *  1. yt-dlp runs `-x --audio-format mp3 --audio-quality <bitrate>K` (FFmpeg
 *     under the hood) to produce a valid, exact-bitrate MP3 container.
 *  2. When cover art is requested, the thumbnail is fetched and fluent-ffmpeg
 *     losslessly embeds it (stream copy) plus ID3 tags into the final file.
 */
async function processMp3(opts: {
  downloadUrl: string;
  info: VideoInfo;
  quality: string;
  embedThumbnail: boolean;
  workDir: string;
}): Promise<string> {
  const { downloadUrl, info, quality, embedThumbnail, workDir } = opts;

  await invokeYtDlpWithFallback(
    downloadUrl,
    {
      ...BASE_DOWNLOAD_FLAGS,
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: `${quality}K`,
      addMetadata: true,
      output: path.join(workDir, "audio.%(ext)s"),
    },
    { cwd: workDir, timeout: 10 * 60 * 1000 },
  );

  const audioPath = await findFile(workDir, [".mp3"], "audio");
  if (!audioPath) {
    throw new Error("Failed to extract and encode the audio stream.");
  }

  if (!embedThumbnail) return audioPath;

  let coverPath: string | null = null;
  try {
    await invokeYtDlp(
      downloadUrl,
      {
        ...BASE_DOWNLOAD_FLAGS,
        skipDownload: true,
        writeThumbnail: true,
        convertThumbnails: "jpg",
        output: path.join(workDir, "cover.%(ext)s"),
      },
      { cwd: workDir, timeout: 60_000 },
    );
    coverPath = await findFile(workDir, [".jpg", ".jpeg", ".png"], "cover");
  } catch {
    coverPath = null;
  }

  const finalPath = path.join(workDir, "final.mp3");
  await finalizeMp3(audioPath, coverPath, info, finalPath);
  return finalPath;
}

function finalizeMp3(
  inputPath: string,
  coverPath: string | null,
  info: VideoInfo,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath);
    const outputOptions: string[] = ["-id3v2_version", "3"];

    if (coverPath) {
      command.input(coverPath);
      outputOptions.push(
        "-map",
        "0:a:0",
        "-map",
        "1:0",
        "-c:a",
        "copy",
        "-c:v",
        "mjpeg",
        "-metadata:s:v",
        "title=Album cover",
        "-metadata:s:v",
        "comment=Cover (front)",
      );
    } else {
      outputOptions.push("-c:a", "copy");
    }

    outputOptions.push(
      "-metadata",
      `title=${info.title}`,
      "-metadata",
      `artist=${info.channel}`,
      "-metadata",
      "album=CholeyTube",
    );

    command
      // Spread (rather than pass an array) so fluent-ffmpeg does NOT split
      // options containing spaces (e.g. "title=Album cover").
      .outputOptions(...outputOptions)
      .on("error", (err, _stdout, stderr) =>
        reject(new Error(stderr || err?.message || "FFmpeg failed to finalize the MP3.")),
      )
      .on("end", () => resolve())
      .save(outputPath);
  });
}

/**
 * MP4 pipeline: yt-dlp selects the best video+audio streams at or below the
 * requested resolution and merges them into a single MP4 container.
 */
async function processMp4(opts: {
  downloadUrl: string;
  info: VideoInfo;
  quality: string;
  workDir: string;
}): Promise<string> {
  const { downloadUrl, info, quality, workDir } = opts;

  await invokeYtDlpWithFallback(
    downloadUrl,
    {
      ...BASE_DOWNLOAD_FLAGS,
      format: mp4FormatSelector(quality),
      mergeOutputFormat: "mp4",
      output: path.join(workDir, `${sanitizeFilename(info.title)}.%(ext)s`),
    },
    { cwd: workDir, timeout: 15 * 60 * 1000 },
  );

  const expected = path.join(workDir, `${sanitizeFilename(info.title)}.mp4`);
  if (await fileExists(expected)) return expected;

  const found = await findFile(workDir, [".mp4"]);
  if (found) return found;

  throw new Error("Failed to download and merge the video stream.");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function streamFile(
  filePath: string,
  fileName: string,
  type: "mp3" | "mp4",
): Response {
  const stat = fs.statSync(filePath);
  const nodeStream = fs.createReadStream(filePath);

  const headers = new Headers();
  headers.set("Content-Disposition", contentDisposition(fileName));
  headers.set("Content-Type", type === "mp3" ? "audio/mpeg" : "video/mp4");
  headers.set("Content-Length", String(stat.size));
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

  // Best-effort cleanup of the temporary working directory after streaming.
  const dir = path.dirname(filePath);
  nodeStream.on("close", () => {
    fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  });
  nodeStream.on("error", () => {
    fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  return new Response(webStream, { headers });
}

function contentDisposition(fileName: string): string {
  const fallback =
    fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "download";
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
