import youtubedl, { type Format, type Payload } from "youtube-dl-exec";
import ffmpegStatic from "ffmpeg-static";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * Resolve the yt-dlp binary shipped with youtube-dl-exec (or fall back to PATH).
 */
const BIN_DIR = path.join(os.tmpdir(), "choleytube-bin");
const YT_DLP_BIN = path.join(BIN_DIR, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

function resolveBinary(): string {
  const candidates = [
    YT_DLP_BIN,
    path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "yt-dlp";
}

function buildExec() {
  return youtubedl.create(resolveBinary());
}

export type NormalisedFormat = {
  id: string;
  label: string;
  ext: string;
  height?: number;
  fps?: number;
  filesize?: number;
  approxSize?: string;
  kind: "video" | "audio" | "video-only" | "audio-only";
  container?: string;
  acodec?: string;
  vcodec?: string;
};

export type VideoInfo = {
  id: string;
  title: string;
  uploader: string;
  channel: string;
  duration: number;
  durationLabel: string;
  thumbnail: string;
  webpage_url: string;
  formats: NormalisedFormat[];
};

function humanSize(bytes?: number | null): string | undefined {
  if (!bytes || Number.isNaN(bytes)) return undefined;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function humanDuration(seconds?: number | null): string {
  if (!seconds || Number.isNaN(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const PREFERRED_VIDEO_CODECS = ["vp9", "h264", "av01", "h265"];
const PREFERRED_AUDIO_CODECS = ["mp4a", "opus", "vorbis"];

function pickHeight(fmt: Format): number | undefined {
  return fmt.height ?? undefined;
}

function scoreCodec(codec: string | undefined | null, preferred: string[]): number {
  if (!codec) return 0;
  const idx = preferred.findIndex((p) => codec.startsWith(p));
  return idx === -1 ? preferred.length + 1 : preferred.length - idx;
}

export function isSupportedUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchInfo(url: string): Promise<VideoInfo> {
  if (!isSupportedUrl(url)) {
    throw new Error("Please paste a valid http(s) URL.");
  }

  const json = (await buildExec()(url, {
    dumpSingleJson: true,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    skipDownload: true,
    youtubeSkipDashManifest: true,
  })) as Payload;

  const rawFormats: Format[] = json.formats ?? [];

  // Dedupe progressive mp4s (video+audio) by height, keep the best.
  const progressive = rawFormats
    .filter((f) => f.vcodec !== "none" && f.acodec !== "none" && f.height)
    .sort((a, b) => {
      const ha = a.height ?? 0;
      const hb = b.height ?? 0;
      if (hb !== ha) return hb - ha;
      return (b.filesize ?? b.filesize_approx ?? 0) - (a.filesize ?? a.filesize_approx ?? 0);
    });

  const seenHeights = new Set<number>();
  const progressiveUnique: Format[] = [];
  for (const f of progressive) {
    const h = f.height as number;
    if (seenHeights.has(h)) continue;
    seenHeights.add(h);
    progressiveUnique.push(f);
  }

  // Best video-only stream per height.
  const videoOnly = rawFormats
    .filter((f) => f.vcodec !== "none" && f.acodec === "none" && f.height)
    .sort((a, b) => {
      const ha = a.height ?? 0;
      const hb = b.height ?? 0;
      if (hb !== ha) return hb - ha;
      return scoreCodec(b.vcodec, PREFERRED_VIDEO_CODECS) - scoreCodec(a.vcodec, PREFERRED_VIDEO_CODECS);
    });

  const bestVideoByHeight = new Map<number, Format>();
  for (const f of videoOnly) {
    const h = f.height as number;
    if (!bestVideoByHeight.has(h)) bestVideoByHeight.set(h, f);
  }

  // Best audio-only stream (prefer m4a, then webm/opus).
  const audioOnly = rawFormats
    .filter((f) => f.vcodec === "none" && f.acodec !== "none" && f.abr)
    .sort((a, b) => {
      const ab = b.abr ?? 0;
      const aa = a.abr ?? 0;
      if (ab !== aa) return ab - aa;
      return scoreCodec(b.acodec, PREFERRED_AUDIO_CODECS) - scoreCodec(a.acodec, PREFERRED_AUDIO_CODECS);
    });

  const formats: NormalisedFormat[] = [];

  for (const f of [...progressiveUnique, ...bestVideoByHeight.values()].slice(0, 12)) {
    const height = pickHeight(f);
    if (!height) continue;
    const size = f.filesize ?? f.filesize_approx ?? null;
    const isProgressive = f.vcodec !== "none" && f.acodec !== "none";
    formats.push({
      id: f.format_id,
      label: `${height}p${f.fps && f.fps > 30 ? Math.round(f.fps) : ""} · ${isProgressive ? f.ext.toUpperCase() : "MP4 (merged)"}`,
      ext: "mp4",
      height,
      fps: f.fps ?? undefined,
      filesize: size ?? undefined,
      approxSize: humanSize(size),
      kind: isProgressive ? "video" : "video-only",
      container: f.ext,
      vcodec: f.vcodec,
      acodec: f.acodec,
    });
  }

  // If we couldn't find anything progressive, fall back to bestvideo+bestaudio.
  if (!formats.some((f) => f.kind === "video")) {
    formats.unshift({
      id: "best",
      label: "Best available (auto)",
      ext: "mp4",
      kind: "video",
      approxSize: humanSize(json.filesize_approx),
    });
  }

  // Audio-only mp3 option (always offered).
  formats.push({
    id: "mp3",
    label: "Audio only · MP3",
    ext: "mp3",
    kind: "audio",
    approxSize: humanSize(json.filesize_approx ? Math.round(json.filesize_approx / 8) : undefined),
  });

  formats.sort((a, b) => {
    if (a.kind === "audio" && b.kind !== "audio") return 1;
    if (b.kind === "audio" && a.kind !== "audio") return -1;
    return (b.height ?? 0) - (a.height ?? 0);
  });

  const thumb =
    json.thumbnail ??
    (Array.isArray(json.thumbnails) && json.thumbnails.length > 0
      ? json.thumbnails[json.thumbnails.length - 1]?.url
      : undefined);

  return {
    id: json.id ?? "",
    title: json.title ?? "Untitled video",
    uploader: json.uploader ?? json.uploader_id ?? "Unknown",
    channel: json.channel ?? json.uploader ?? "Unknown channel",
    duration: json.duration ?? 0,
    durationLabel: humanDuration(json.duration),
    thumbnail: thumb ?? "",
    webpage_url: json.webpage_url ?? url,
    formats,
  };
  // suppress unused-warning: audioOnly list (reserved for future UI)
  void audioOnly;
}

export type DownloadRequest = {
  url: string;
  formatId: string;
  kind: "video" | "audio" | "video-only" | "audio-only";
  height?: number;
  title: string;
};

export function buildFormatSelector(req: DownloadRequest): { format: string; mergeOutputFormat?: string } {
  if (req.kind === "audio" || req.formatId === "mp3") {
    return { format: "bestaudio/best", mergeOutputFormat: "mp3" };
  }
  if (req.formatId === "best") {
    return { format: "bestvideo*+bestaudio/best", mergeOutputFormat: "mp4" };
  }
  if (req.kind === "video-only") {
    // Merge with best audio into mp4.
    return { format: `${req.formatId}+bestaudio/best`, mergeOutputFormat: "mp4" };
  }
  // progressive
  return { format: `${req.formatId}/best[ext=mp4][height<=?${req.height ?? 2160}]/best` };
}

export function safeFilename(title: string, ext: string): string {
  const cleaned = (title || "choleytube")
    .replace(/[\/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${cleaned || "choleytube"}.${ext}`;
}

export function getFfmpegPath(): string | undefined {
  return ffmpegStatic as unknown as string | undefined;
}
