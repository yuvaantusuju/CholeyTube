import path from "node:path";
import fsp from "node:fs/promises";
import youtubedl from "yt-dlp-exec";
import ffmpegStaticPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import type { VideoInfo } from "./types";

export const FFMPEG_PATH: string | null = ffmpegStaticPath;
export const FFPROBE_PATH: string = ffprobeStatic.path;

const MP4_FORMAT_SELECTORS: Record<string, string> = {
  "360": "bestvideo[height<=360]+bestaudio/best[height<=360]/best",
  "480": "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
  "720": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
  "1080": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
  "2160": "bestvideo[height<=2160]+bestaudio/best[height<=2160]/best",
};

/**
 * Thin wrapper around the yt-dlp-exec binary. The bundled typings expose a
 * narrow, older set of flags, so we accept any camelCase flag (mapped to
 * kebab-case by the library) and cast once here to keep call sites clean.
 */
export function invokeYtDlp(
  url: string,
  flags: Record<string, unknown>,
  opts?: { cwd?: string; timeout?: number; env?: Record<string, string> },
): Promise<any> {
  return youtubedl(url, flags as any, opts as any);
}

function isDownloadBlocked(err: unknown): boolean {
  const msg = String(
    (err as { stderr?: string } | null)?.stderr ||
      (err as { message?: string } | null)?.message ||
      "",
  ).toLowerCase();
  return (
    msg.includes("403") ||
    msg.includes("http error 4") ||
    msg.includes("unable to download video data") ||
    msg.includes("premature end of file") ||
    msg.includes("connection reset")
  );
}

/**
 * YouTube intermittently rate-limits (HTTP 403) the default Android-VR client
 * from datacenter IPs. When that happens we transparently retry the same
 * command through alternate player clients, which serve different streams.
 */
export async function invokeYtDlpWithFallback(
  url: string,
  flags: Record<string, unknown>,
  opts?: { cwd?: string; timeout?: number; env?: Record<string, string> },
): Promise<any> {
  try {
    return await invokeYtDlp(url, flags, opts);
  } catch (firstError) {
    if (!isDownloadBlocked(firstError)) throw firstError;
    let lastError = firstError;
    for (const client of ["android", "ios"]) {
      try {
        return await invokeYtDlp(
          url,
          { ...flags, extractorArgs: `youtube:player_client=${client}` },
          opts,
        );
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }
}

export function isYouTubeUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(url.trim());
}

export function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/i,
  );
  return match ? match[1] : null;
}

export function isPlaylistUrl(url: string): boolean {
  return /youtube\.com\/playlist/i.test(url) || /[?&]list=[\w-]+/i.test(url);
}

export function mp4FormatSelector(quality: string): string {
  return MP4_FORMAT_SELECTORS[quality] ?? MP4_FORMAT_SELECTORS["720"];
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return "LIVE";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function formatViewCount(count?: number | null): string {
  if (!count) return "";
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B views`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

export function sanitizeFilename(title: string): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*%\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/g, "");
  return cleaned.slice(0, 120) || "cholytube";
}

interface RawThumbnail {
  url?: string;
  width?: number;
  height?: number;
}

function pickThumbnail(thumbnails?: RawThumbnail[]): string | null {
  if (!thumbnails || thumbnails.length === 0) return null;
  const ranked = [...thumbnails].sort(
    (a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0),
  );
  return ranked[0]?.url ?? null;
}

/**
 * Normalize the raw `--dump-single-json` payload (single video or playlist)
 * into a UI-friendly `VideoInfo`. For playlists, the first entry is used as the
 * representative item shown on the preview card.
 */
export function normalizeVideoInfo(raw: any, fallbackUrl: string): VideoInfo {
  let entry = raw;
  let isPlaylist = false;
  let playlistTitle: string | null = null;
  let playlistCount: number | null = null;

  if (raw && Array.isArray(raw.entries) && raw.entries.length > 0) {
    isPlaylist = true;
    playlistTitle = typeof raw.title === "string" ? raw.title : null;
    playlistCount = raw.entries.length;
    const first = raw.entries.find(
      (e: any) => e && (e.id || e.webpage_url || e.url),
    );
    if (first) entry = first;
  }

  const title =
    typeof entry?.title === "string" && entry.title ? entry.title : "Untitled";
  const channel =
    entry?.channel ||
    entry?.uploader ||
    entry?.uploader_id ||
    entry?.creator ||
    "Unknown";
  const channelUrl = entry?.channel_url || entry?.uploader_url || null;
  const duration = typeof entry?.duration === "number" ? entry.duration : null;
  const isLive = Boolean(entry?.is_live);
  const width = entry?.width;
  const height = entry?.height;
  const isShort =
    !isPlaylist &&
    typeof width === "number" &&
    typeof height === "number" &&
    height > width;

  return {
    id: typeof entry?.id === "string" ? entry.id : "",
    title,
    channel,
    channelUrl,
    duration,
    durationLabel: isLive ? "LIVE" : formatDuration(duration),
    thumbnail:
      typeof entry?.thumbnail === "string"
        ? entry.thumbnail
        : pickThumbnail(entry?.thumbnails),
    viewCount: typeof entry?.view_count === "number" ? entry.view_count : null,
    uploadDate: entry?.upload_date ?? null,
    isLive,
    isShort,
    isPlaylist,
    playlistTitle,
    playlistCount,
    webpageUrl: entry?.webpage_url || entry?.original_url || entry?.url || fallbackUrl,
  };
}

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
  const raw = await invokeYtDlp(
    url,
    {
      dumpSingleJson: true,
      skipDownload: true,
      noWarnings: true,
      noCheckCertificates: true,
    },
    { timeout: 90_000 },
  );
  return normalizeVideoInfo(raw, url);
}

export async function findFile(
  dir: string,
  exts: string[],
  prefix?: string,
): Promise<string | null> {
  const entries = await fsp.readdir(dir);
  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (!exts.includes(ext)) continue;
    if (prefix && !name.startsWith(prefix)) continue;
    if (/\.(part|ytdl|frag|temp)$/i.test(name)) continue;
    return path.join(dir, name);
  }
  return null;
}

export function friendlyError(err: unknown): string {
  const source =
    (err as { stderr?: string } | null)?.stderr ||
    (err as { stdout?: string } | null)?.stdout ||
    (err as { message?: string } | null)?.message ||
    String(err || "");
  const raw = String(source).toLowerCase();

  if (raw.includes("sign in to confirm") || raw.includes("confirm your age")) {
    return "YouTube requires sign-in or age verification for this video. Try a different one.";
  }
  if (raw.includes("private video") || raw.includes("this video is private")) {
    return "This video is private and can't be downloaded.";
  }
  if (
    raw.includes("403") ||
    raw.includes("http error 4") ||
    raw.includes("unable to download video data")
  ) {
    return "YouTube temporarily blocked this download (rate limit). Please try again in a moment.";
  }
  if (
    raw.includes("not available in your country") ||
    raw.includes("video unavailable") ||
    raw.includes("this video is not available")
  ) {
    return "This video is not available in your region.";
  }
  if (raw.includes("copyright") || raw.includes("has been removed")) {
    return "This video was removed or is no longer available.";
  }
  if (raw.includes("unsupported url") || raw.includes("is not a valid url")) {
    return "That doesn't look like a valid YouTube link.";
  }
  if (raw.includes("ffmpeg") || raw.includes("ffprobe")) {
    return "FFmpeg is missing or failed to process the media.";
  }
  if (raw.includes("timed out") || raw.includes("etimedout")) {
    return "The request timed out. Please try again.";
  }
  return "Something went wrong while processing your request. Please try again.";
}
