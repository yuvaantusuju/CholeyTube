/**
 * Shared contracts between the API layer (`/api/download`) and the UI.
 * Keeping these in one place means the client never has to guess a shape.
 */

export type MediaKind = "video" | "audio";

export type ResolveMode = "live" | "preview";

export interface MediaFormat {
  /** Stable id used as a React key and as the download request identifier. */
  id: string;
  kind: MediaKind;
  /** Human label shown in the table: "1080p" / "320kbps". */
  label: string;
  /** Extra descriptor: "Full HD", "High quality"… */
  description: string;
  container: "mp4" | "mp3" | "m4a" | "webm";
  /** Video only. */
  heightPx?: number;
  /** Audio only (or the combined bitrate estimate for video rows). */
  bitrateKbps: number;
  /** Approximate transfer size in bytes (null when duration is unknown). */
  approxSizeBytes: number | null;
  /** true when the size was derived from bitrate × duration instead of a real header. */
  estimated: boolean;
  /** Whether a direct media URL is currently available. */
  available: boolean;
  /** Direct media URL (used for "copy link"). */
  url: string | null;
  /**
   * Same-origin signed URL that streams the file with
   * `Content-Disposition: attachment` so the browser actually saves it.
   */
  proxyUrl: string | null;
  /** true when this rung is produced by merging separate video + audio tracks. */
  muxed: boolean;
  note?: string;
}

export interface VideoResult {
  videoId: string;
  title: string;
  channel: string;
  channelUrl: string | null;
  thumbnail: string;
  durationSeconds: number | null;
  durationLabel: string;
  watchUrl: string;
  /** Where the metadata came from. */
  metadataSource: "youtube-data-api" | "oembed" | "watch-page" | "minimal";
  /** true when metadata could not be read and placeholders are shown. */
  degraded: boolean;
  /** "live" when a resolver returned real links, "preview" when links are placeholders. */
  mode: ResolveMode;
  /** Host that produced the download links (or the configured reference host). */
  resolverHost: string;
  notice: string | null;
  formats: MediaFormat[];
  /**
   * Openly-licensed sample files, offered in preview mode so the download
   * pipeline can be verified end-to-end. Empty when a real resolver is live.
   */
  samples: SampleDownload[];
  cached: boolean;
  fetchedAt: string;
  elapsedMs: number;
}

export interface SampleDownload {
  id: string;
  kind: MediaKind;
  label: string;
  description: string;
  container: string;
  /** Signed same-origin URL that force-downloads the file. */
  proxyUrl: string;
  credit: {
    title: string;
    author: string;
    licence: string;
    licenceUrl: string;
    sourceUrl: string;
  };
}

export interface ApiSuccess {
  ok: true;
  data: VideoResult;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    hint?: string;
  };
}

export type ApiResponse = ApiSuccess | ApiFailure;

export type ApiErrorCode =
  | "EMPTY_INPUT"
  | "INVALID_URL"
  | "NOT_YOUTUBE"
  | "VIDEO_UNAVAILABLE"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_TIMEOUT"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";
