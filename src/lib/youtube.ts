/**
 * YouTube URL parsing / validation helpers.
 * Pure functions – shared by both the browser and the route handler.
 */

const YT_ID = /^[a-zA-Z0-9_-]{11}$/;

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

export type ParseResult =
  | { ok: true; videoId: string; watchUrl: string }
  | { ok: false; code: "EMPTY_INPUT" | "INVALID_URL" | "NOT_YOUTUBE"; message: string };

/** Quick client-side check used to enable/disable the submit button. */
export function looksLikeYouTubeUrl(raw: string): boolean {
  return parseYouTubeUrl(raw).ok;
}

export function parseYouTubeUrl(raw: string): ParseResult {
  const input = (raw ?? "").trim();

  if (!input) {
    return { ok: false, code: "EMPTY_INPUT", message: "Paste a YouTube link to get started." };
  }

  // Bare video id support: "dQw4w9WgXcQ"
  if (YT_ID.test(input)) {
    return { ok: true, videoId: input, watchUrl: watchUrlFor(input) };
  }

  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, code: "INVALID_URL", message: "That does not look like a valid URL." };
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return {
      ok: false,
      code: "NOT_YOUTUBE",
      message: "Only youtube.com and youtu.be links are supported.",
    };
  }

  const id = extractId(url);
  if (!id) {
    return {
      ok: false,
      code: "INVALID_URL",
      message: "Could not find a video id in that link.",
    };
  }

  return { ok: true, videoId: id, watchUrl: watchUrlFor(id) };
}

function extractId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host.endsWith("youtu.be")) {
    return YT_ID.test(segments[0] ?? "") ? segments[0] : null;
  }

  const queryId = url.searchParams.get("v");
  if (queryId && YT_ID.test(queryId)) return queryId;

  // /shorts/<id>, /embed/<id>, /live/<id>, /v/<id>
  const prefixed = ["shorts", "embed", "live", "v"];
  if (segments.length >= 2 && prefixed.includes(segments[0])) {
    return YT_ID.test(segments[1]) ? segments[1] : null;
  }

  // /watch/<id>
  if (segments.length >= 2 && segments[0] === "watch" && YT_ID.test(segments[1])) {
    return segments[1];
  }

  return null;
}

export function watchUrlFor(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function thumbnailFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** ISO-8601 duration ("PT4M13S") → seconds. */
export function iso8601ToSeconds(iso: string): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  const [, d, h, min, s] = m;
  const total =
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
