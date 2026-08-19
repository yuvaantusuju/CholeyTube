import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { VIDEO_LADDER } from "./formats";

const run = promisify(execFile);

const YTDLP = process.env.YTDLP_PATH ?? "yt-dlp";

export interface ResolvedLink {
  url: string;
  sizeBytes: number | null;
  /** Set when the rung exists upstream but isn't directly downloadable. */
  unavailableNote?: string;
}

export interface MuxPair {
  videoUrl: string;
  audioUrl: string;
  sizeBytes: number | null;
}

export interface LocalResolveResult {
  links: Record<string, ResolvedLink>;
  muxPairs: Record<string, MuxPair>;
  notes: Record<string, string>;
  title: string | null;
  durationSeconds: number | null;
}

interface YtFormat {
  url?: string;
  ext?: string;
  height?: number | null;
  abr?: number | null;
  tbr?: number | null;
  vcodec?: string;
  acodec?: string;
  filesize?: number | null;
  filesize_approx?: number | null;
  format_note?: string;
  protocol?: string;
}

interface YtPayload {
  title?: string;
  duration?: number;
  formats?: YtFormat[];
}

let availability: boolean | null = null;
let ffmpegAvailability: boolean | null = null;

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

/** Cached check for whether ffmpeg is present (required for muxed rungs). */
export async function ffmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailability !== null) return ffmpegAvailability;
  try {
    await run(FFMPEG, ["-version"], { timeout: 8_000 });
    ffmpegAvailability = true;
  } catch {
    ffmpegAvailability = false;
  }
  return ffmpegAvailability;
}

/** Cached check for whether the yt-dlp binary is usable. */
export async function ytdlpAvailable(): Promise<boolean> {
  if (availability !== null) return availability;
  if (process.env.YTDLP_DISABLED === "1") {
    availability = false;
    return false;
  }
  try {
    await run(YTDLP, ["--version"], { timeout: 8_000 });
    availability = true;
  } catch {
    availability = false;
  }
  return availability;
}

function sizeOf(f: YtFormat): number | null {
  return f.filesize ?? f.filesize_approx ?? null;
}

/** Plain HTTPS only — HLS/DASH manifests can't be saved as a single file. */
function isDirect(f: YtFormat): boolean {
  return Boolean(f.url) && (f.protocol === "https" || f.protocol === "http");
}

/**
 * Extracts direct media URLs with yt-dlp.
 *
 * Video rungs use *progressive* streams (audio+video in one file) so the
 * browser can save them directly. YouTube only publishes those at lower
 * resolutions; higher rungs exist solely as separate video/audio tracks that
 * would need ffmpeg muxing, so they're reported as unavailable with a reason
 * rather than silently handing back a silent video file.
 */
export async function resolveWithYtdlp(url: string): Promise<LocalResolveResult> {
  const { stdout } = await run(
    YTDLP,
    [
      "--dump-single-json",
      "--no-warnings",
      "--no-playlist",
      "--socket-timeout",
      "20",
      url,
    ],
    { maxBuffer: 64 * 1024 * 1024, timeout: 60_000 },
  );

  const info = JSON.parse(stdout) as YtPayload;
  const formats = (info.formats ?? []).filter(isDirect);

  const links: Record<string, ResolvedLink> = {};
  const muxPairs: Record<string, MuxPair> = {};
  const notes: Record<string, string> = {};

  // ---- Video: progressive (already muxed) ------------------------------
  const progressive = formats.filter(
    (f) =>
      f.vcodec &&
      f.vcodec !== "none" &&
      f.acodec &&
      f.acodec !== "none" &&
      (f.ext === "mp4" || f.ext === "webm"),
  );

  // Video-only tracks, preferring H.264 in MP4 so `-c copy` stays lossless
  // and the result plays everywhere.
  const videoOnly = formats.filter(
    (f) => f.vcodec && f.vcodec !== "none" && (!f.acodec || f.acodec === "none"),
  );

  // Best AAC/M4A audio to pair with a video-only track.
  const muxAudio =
    formats
      .filter(
        (f) =>
          f.acodec &&
          f.acodec !== "none" &&
          (!f.vcodec || f.vcodec === "none") &&
          (f.ext === "m4a" || f.acodec.startsWith("mp4a")),
      )
      .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0] ?? null;

  const canMux = await ffmpegAvailable();

  for (const rung of VIDEO_LADDER) {
    const id = `mp4-${rung.heightPx}`;

    const exact = progressive
      .filter((f) => (f.height ?? 0) === rung.heightPx)
      .sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0))[0];

    if (exact?.url) {
      links[id] = { url: exact.url, sizeBytes: sizeOf(exact) };
      continue;
    }

    const track =
      videoOnly
        .filter((f) => (f.height ?? 0) === rung.heightPx)
        .sort((a, b) => {
          const aAvc = a.ext === "mp4" || a.vcodec?.startsWith("avc") ? 1 : 0;
          const bAvc = b.ext === "mp4" || b.vcodec?.startsWith("avc") ? 1 : 0;
          return bAvc - aAvc || (b.tbr ?? 0) - (a.tbr ?? 0);
        })[0] ?? null;

    if (!track?.url) {
      notes[id] = "Not published at this resolution";
      continue;
    }

    if (!muxAudio?.url) {
      notes[id] = "No compatible audio track to merge with";
      continue;
    }

    if (!canMux) {
      notes[id] = "Needs ffmpeg — install it to enable this resolution";
      continue;
    }

    muxPairs[id] = {
      videoUrl: track.url,
      audioUrl: muxAudio.url,
      sizeBytes:
        sizeOf(track) !== null && sizeOf(muxAudio) !== null
          ? (sizeOf(track) as number) + (sizeOf(muxAudio) as number)
          : null,
    };
  }

  // ---- Audio: audio-only streams ---------------------------------------
  const audioOnly = formats
    .filter((f) => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"))
    .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0));

  const audioRungs = [320, 256, 128];
  for (const target of audioRungs) {
    // Best stream at or below the requested bitrate, else the lowest available.
    const match =
      audioOnly.find((f) => (f.abr ?? 0) <= target) ?? audioOnly[audioOnly.length - 1];

    if (match?.url) {
      links[`mp3-${target}`] = { url: match.url, sizeBytes: sizeOf(match) };
    } else {
      notes[`mp3-${target}`] = "No audio stream available";
    }
  }

  const verified = await verifyLinks(links, notes);
  const verifiedMux = await verifyMuxPairs(muxPairs, notes);

  return {
    links: verified,
    muxPairs: verifiedMux,
    notes,
    title: info.title ?? null,
    durationSeconds: typeof info.duration === "number" ? Math.round(info.duration) : null,
  };
}

/** Both tracks of a mux pair must be fetchable, or the merge fails mid-download. */
async function verifyMuxPairs(
  pairs: Record<string, MuxPair>,
  notes: Record<string, string>,
): Promise<Record<string, MuxPair>> {
  if (process.env.VERIFY_LINKS === "0") return pairs;

  const results = await Promise.all(
    Object.entries(pairs).map(async ([id, pair]) => {
      const [video, audio] = await Promise.all([probe(pair.videoUrl), probe(pair.audioUrl)]);
      return { id, pair, ok: video && audio };
    }),
  );

  const kept: Record<string, MuxPair> = {};
  for (const { id, pair, ok } of results) {
    if (ok) kept[id] = pair;
    else notes[id] = "Blocked by YouTube for this server's IP (403)";
  }
  return kept;
}

/**
 * Confirms each extracted URL actually serves bytes before we advertise it.
 *
 * YouTube's media URLs are bound to the extracting IP and are frequently
 * refused (HTTP 403) when the request originates from a datacenter/cloud
 * range, even though metadata extraction succeeded. Probing here means the UI
 * only ever shows a Download button that genuinely works, instead of handing
 * the user a link that fails after they click it.
 */
async function verifyLinks(
  links: Record<string, ResolvedLink>,
  notes: Record<string, string>,
): Promise<Record<string, ResolvedLink>> {
  if (process.env.VERIFY_LINKS === "0") return links;

  const entries = Object.entries(links);
  const results = await Promise.all(
    entries.map(async ([id, link]) => {
      const ok = await probe(link.url);
      return { id, link, ok };
    }),
  );

  const kept: Record<string, ResolvedLink> = {};
  for (const { id, link, ok } of results) {
    if (ok) {
      kept[id] = link;
    } else {
      notes[id] = "Blocked by YouTube for this server's IP (403)";
    }
  }
  return kept;
}

/**
 * Range request for a real chunk of the file.
 *
 * A single-byte probe is not sufficient: Google will serve `bytes=0-0` from a
 * blocked IP and then refuse the actual transfer, which produces a Download
 * button that fails only after the user clicks it. Pulling a genuine chunk and
 * requiring the bytes to arrive matches what the proxy will really do.
 */
async function probe(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: {
        Range: "bytes=0-131071",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status !== 200 && res.status !== 206) {
      clearTimeout(timer);
      await res.body?.cancel().catch(() => undefined);
      return false;
    }

    const buffer = await res.arrayBuffer();
    clearTimeout(timer);
    // Require a substantive chunk — an empty 206 means the transfer was refused.
    return buffer.byteLength >= 1024;
  } catch {
    return false;
  }
}
