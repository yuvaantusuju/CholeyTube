import { createClient, describeAxiosError } from "./http";
import { iso8601ToSeconds, thumbnailFor, watchUrlFor } from "./youtube";

export interface VideoMetadata {
  title: string;
  channel: string;
  channelUrl: string | null;
  thumbnail: string;
  durationSeconds: number | null;
  source: "youtube-data-api" | "oembed" | "watch-page" | "minimal";
  /** true when we could not read real metadata and fell back to placeholders. */
  degraded: boolean;
  /** Human-readable reason, surfaced in the UI when degraded. */
  degradedReason?: string;
}

export class MetadataError extends Error {
  readonly code: "VIDEO_UNAVAILABLE" | "UPSTREAM_ERROR";

  constructor(code: "VIDEO_UNAVAILABLE" | "UPSTREAM_ERROR", message: string) {
    super(message);
    this.code = code;
    this.name = "MetadataError";
  }
}

interface OEmbedPayload {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
}

interface DataApiPayload {
  items?: Array<{
    snippet?: {
      title?: string;
      channelTitle?: string;
      channelId?: string;
      thumbnails?: Record<string, { url?: string; width?: number }>;
    };
    contentDetails?: { duration?: string };
  }>;
}

/**
 * Layered metadata resolution.
 *
 * Tiers are tried in order and the first usable answer wins:
 *   1. YouTube Data API v3   (needs YOUTUBE_API_KEY, gives exact duration)
 *   2. Public oEmbed         (no key, no duration)
 *   3. Watch page scrape     (title + author + duration)
 *   4. Minimal placeholder   (thumbnail only — never blocks the UI)
 *
 * Only a *definitively* unavailable video (private / deleted / blocked) throws.
 * Transient upstream problems degrade instead of failing the whole request,
 * because the thumbnail and video id are derivable without any network call.
 */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const problems: string[] = [];

  // ---- Tier 1: Data API -------------------------------------------------
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const viaApi = await fetchFromDataApi(videoId, apiKey);
      if (viaApi) return viaApi;
      problems.push("Data API returned no items");
    } catch (error) {
      if (error instanceof MetadataError && error.code === "VIDEO_UNAVAILABLE") throw error;
      problems.push(`Data API: ${describeError(error)}`);
    }
  }

  // ---- Tier 2: oEmbed ---------------------------------------------------
  let base: VideoMetadata | null = null;
  try {
    base = await fetchFromOEmbed(videoId);
  } catch (error) {
    // A hard "unavailable" verdict is authoritative — stop here.
    if (error instanceof MetadataError && error.code === "VIDEO_UNAVAILABLE") throw error;
    problems.push(`oEmbed: ${describeError(error)}`);
  }

  // ---- Tier 3: watch page ----------------------------------------------
  // Always consulted when we still need a duration (oEmbed never supplies one).
  const scraped = await scrapeWatchPage(videoId);

  if (scraped?.unavailableReason) {
    throw new MetadataError("VIDEO_UNAVAILABLE", scraped.unavailableReason);
  }

  if (base) {
    return { ...base, durationSeconds: base.durationSeconds ?? scraped?.durationSeconds ?? null };
  }

  if (scraped?.title) {
    return {
      title: scraped.title,
      channel: scraped.author ?? "Unknown channel",
      channelUrl: scraped.channelId
        ? `https://www.youtube.com/channel/${scraped.channelId}`
        : null,
      thumbnail: thumbnailFor(videoId),
      durationSeconds: scraped.durationSeconds,
      source: "watch-page",
      degraded: false,
    };
  }

  problems.push("watch page: no videoDetails found");

  // ---- Tier 4: minimal --------------------------------------------------
  // The thumbnail URL is deterministic, so the UI stays useful even here.
  return {
    title: `YouTube video ${videoId}`,
    channel: "Channel unavailable",
    channelUrl: null,
    thumbnail: thumbnailFor(videoId),
    durationSeconds: null,
    source: "minimal",
    degraded: true,
    degradedReason: `Could not read video details (${problems.join("; ")}).`,
  };
}

function describeError(error: unknown): string {
  if (error instanceof MetadataError) return error.message;
  return describeAxiosError(error);
}

async function fetchFromDataApi(videoId: string, apiKey: string): Promise<VideoMetadata | null> {
  const client = createClient("https://www.googleapis.com", "https://www.youtube.com/");
  const res = await client.get<DataApiPayload>("/youtube/v3/videos", {
    params: { part: "snippet,contentDetails", id: videoId, key: apiKey },
  });

  if (res.status !== 200) return null;

  const item = res.data?.items?.[0];
  if (!item) {
    throw new MetadataError(
      "VIDEO_UNAVAILABLE",
      "That video is private, deleted, or not visible to the API key in use.",
    );
  }

  const thumbs = item.snippet?.thumbnails ?? {};
  const best = Object.values(thumbs)
    .filter((t): t is { url: string; width: number } => Boolean(t?.url))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

  return {
    title: item.snippet?.title?.trim() || "Untitled video",
    channel: item.snippet?.channelTitle?.trim() || "Unknown channel",
    channelUrl: item.snippet?.channelId
      ? `https://www.youtube.com/channel/${item.snippet.channelId}`
      : null,
    thumbnail: best?.url ?? thumbnailFor(videoId),
    durationSeconds: iso8601ToSeconds(item.contentDetails?.duration ?? ""),
    source: "youtube-data-api",
    degraded: false,
  };
}

async function fetchFromOEmbed(videoId: string): Promise<VideoMetadata> {
  const client = createClient("https://www.youtube.com", "https://www.youtube.com/");

  let res;
  try {
    res = await client.get<OEmbedPayload>("/oembed", {
      params: { url: watchUrlFor(videoId), format: "json" },
    });
  } catch (error) {
    throw new MetadataError("UPSTREAM_ERROR", describeAxiosError(error));
  }

  // 400 = malformed/unknown id, 401/403 = embedding restricted, 404 = gone.
  // All of these are verdicts about the video, not about our infrastructure.
  if ([400, 401, 403, 404].includes(res.status)) {
    throw new MetadataError(
      "VIDEO_UNAVAILABLE",
      "That video can't be read — it may be private, deleted, region-locked, or blocked from embedding.",
    );
  }

  if (res.status !== 200 || typeof res.data !== "object" || res.data === null) {
    throw new MetadataError("UPSTREAM_ERROR", `oEmbed responded with ${res.status}`);
  }

  return {
    title: res.data.title?.trim() || "Untitled video",
    channel: res.data.author_name?.trim() || "Unknown channel",
    channelUrl: res.data.author_url ?? null,
    thumbnail: res.data.thumbnail_url ?? thumbnailFor(videoId),
    durationSeconds: null,
    source: "oembed",
    degraded: false,
  };
}

interface ScrapeResult {
  title: string | null;
  author: string | null;
  channelId: string | null;
  durationSeconds: number | null;
  unavailableReason: string | null;
}

/**
 * Reads the `videoDetails` block YouTube inlines into the public watch page.
 * Soft-fails to null so it can never break the request on its own.
 */
async function scrapeWatchPage(videoId: string): Promise<ScrapeResult | null> {
  try {
    const client = createClient("https://www.youtube.com", "https://www.youtube.com/");
    const res = await client.get<string>("/watch", {
      params: { v: videoId },
      timeout: 9_000,
      responseType: "text",
      headers: { Accept: "text/html,application/xhtml+xml" },
      transformResponse: [(data: unknown) => data],
    });

    if (res.status !== 200 || typeof res.data !== "string") return null;
    const html = res.data;

    const status = readJsonString(html, "status");
    const reason = readJsonString(html, "reason");
    if (status && ["ERROR", "UNPLAYABLE", "LOGIN_REQUIRED"].includes(status)) {
      return {
        title: null,
        author: null,
        channelId: null,
        durationSeconds: null,
        unavailableReason: reason ?? "YouTube reports this video as unplayable.",
      };
    }

    const seconds = Number(readJsonString(html, "lengthSeconds") ?? NaN);

    return {
      title: readJsonString(html, "title"),
      author: readJsonString(html, "author"),
      channelId: readJsonString(html, "channelId"),
      durationSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      unavailableReason: null,
    };
  } catch {
    return null;
  }
}

/** Pulls `"key":"value"` out of inline JSON, honouring backslash escapes. */
function readJsonString(html: string, key: string): string | null {
  const match = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(html);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}
