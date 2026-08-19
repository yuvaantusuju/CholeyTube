import { buildMuxUrl, buildProxyUrl } from "./sign";
import type { MediaFormat } from "./types";

/**
 * Quality ladder used to render the download tables.
 *
 * `bitrateKbps` values are conservative averages for YouTube's H.264 renditions
 * (video + audio muxed) and are used to estimate transfer size when the
 * resolver does not report a real `content-length`.
 */
export const VIDEO_LADDER = [
  { heightPx: 1080, label: "1080p", description: "Full HD · MP4", bitrateKbps: 4200 },
  { heightPx: 720, label: "720p", description: "HD · MP4", bitrateKbps: 2400 },
  { heightPx: 480, label: "480p", description: "SD · MP4", bitrateKbps: 1150 },
  { heightPx: 360, label: "360p", description: "Data saver · MP4", bitrateKbps: 680 },
] as const;

export const AUDIO_LADDER = [
  { bitrateKbps: 320, label: "320kbps", description: "Studio · MP3" },
  { bitrateKbps: 256, label: "256kbps", description: "High · MP3" },
  { bitrateKbps: 128, label: "128kbps", description: "Standard · MP3" },
] as const;

/** bitrate (kbps) × duration (s) → bytes. */
export function estimateBytes(bitrateKbps: number, durationSeconds: number | null): number | null {
  if (!durationSeconds || durationSeconds <= 0) return null;
  return Math.round((bitrateKbps * 1000 * durationSeconds) / 8);
}

interface BuildOptions {
  videoId: string;
  durationSeconds: number | null;
  /** Direct links keyed by format id, supplied by a resolver when available. */
  links?: Record<string, { url: string; sizeBytes?: number | null }>;
  note?: string;
  /** Per-format explanations for rungs that could not be resolved. */
  notes?: Record<string, string>;
  /** Rungs that require merging a separate video and audio track. */
  muxLinks?: Record<string, { videoUrl: string; audioUrl: string; sizeBytes?: number | null }>;
  /** Used to build a human-friendly download filename. */
  title?: string;
}

/** "My Video" + "1080p" + "mp4" → "my-video-1080p.mp4" */
export function downloadFileName(title: string, label: string, container: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "choleytube";
  return `${slug}-${label}.${container}`;
}

/**
 * Builds the full format list. Rows without a resolved link are still rendered
 * (greyed out) so the user can see exactly what the pipeline supports.
 */
export function buildFormatLadder({
  videoId,
  durationSeconds,
  links = {},
  note,
  notes = {},
  muxLinks = {},
  title = "choleytube",
}: BuildOptions): MediaFormat[] {
  const video: MediaFormat[] = VIDEO_LADDER.map((entry) => {
    const id = `mp4-${entry.heightPx}`;
    const link = links[id];
    const mux = muxLinks[id];
    const fileName = downloadFileName(title, entry.label, "mp4");
    const size = link?.sizeBytes ?? mux?.sizeBytes ?? null;

    return {
      id,
      kind: "video",
      label: entry.label,
      description: mux && !link ? `${entry.description} · merged` : entry.description,
      container: "mp4",
      heightPx: entry.heightPx,
      bitrateKbps: entry.bitrateKbps,
      approxSizeBytes: size ?? estimateBytes(entry.bitrateKbps, durationSeconds),
      estimated: size == null,
      available: Boolean(link?.url || mux),
      url: link?.url ?? mux?.videoUrl ?? null,
      proxyUrl: link?.url
        ? buildProxyUrl(link.url, fileName)
        : mux
          ? buildMuxUrl(mux.videoUrl, mux.audioUrl, fileName)
          : null,
      muxed: Boolean(mux && !link),
      note: link?.url || mux ? undefined : (notes[id] ?? note),
    };
  });

  const audio: MediaFormat[] = AUDIO_LADDER.map((entry) => {
    const id = `mp3-${entry.bitrateKbps}`;
    const link = links[id];
    return {
      id,
      kind: "audio",
      label: entry.label,
      description: entry.description,
      container: "mp3",
      bitrateKbps: entry.bitrateKbps,
      approxSizeBytes: link?.sizeBytes ?? estimateBytes(entry.bitrateKbps, durationSeconds),
      estimated: link?.sizeBytes == null,
      available: Boolean(link?.url),
      url: link?.url ?? null,
      proxyUrl: link?.url
        ? buildProxyUrl(link.url, downloadFileName(title, entry.label, "mp3"))
        : null,
      muxed: false,
      note: link?.url ? undefined : (notes[id] ?? note),
    };
  });

  void videoId;
  return [...video, ...audio];
}
