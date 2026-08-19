#!/usr/bin/env node
/**
 * CholeyTube resolver sidecar
 * ---------------------------------------------------------------------------
 * A tiny, dependency-free HTTP service that turns a YouTube URL into the
 * `{ formats: [{ id, kind, url, sizeBytes }] }` payload that CholeyTube's
 * resolver adapter expects.
 *
 * It delegates the actual extraction to yt-dlp, which you install and run
 * yourself — so the extraction happens under your control and your account,
 * not inside the web app.
 *
 * Usage:
 *   1. Install yt-dlp:            pipx install yt-dlp   (or brew install yt-dlp)
 *   2. Start this sidecar:        node resolver/server.mjs
 *   3. Point CholeyTube at it:    RESOLVER_ENDPOINT=http://127.0.0.1:8080/resolve npm start
 *
 * Please only use this for media you own, that you have permission to
 * download, or that is openly licensed.
 */

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.RESOLVER_TOKEN ?? "";
const YTDLP = process.env.YTDLP_PATH ?? "yt-dlp";

/** Target heights / audio bitrates that match CholeyTube's quality ladder. */
const VIDEO_HEIGHTS = [1080, 720, 480, 360];
const AUDIO_BITRATES = [320, 256, 128];

/**
 * Asks yt-dlp for the full format manifest as JSON (no download).
 */
async function probe(url) {
  const { stdout } = await run(
    YTDLP,
    ["--dump-single-json", "--no-warnings", "--no-playlist", url],
    { maxBuffer: 32 * 1024 * 1024, timeout: 45_000 },
  );
  return JSON.parse(stdout);
}

/**
 * Picks, for each rung of the ladder, the best progressive (audio+video) MP4
 * at or below that height. Progressive streams are used because they need no
 * client-side muxing — the browser can save them directly.
 */
function pickVideo(formats) {
  const out = {};

  const progressive = formats.filter(
    (f) =>
      f.url &&
      f.vcodec &&
      f.vcodec !== "none" &&
      f.acodec &&
      f.acodec !== "none" &&
      (f.ext === "mp4" || f.ext === "webm"),
  );

  for (const height of VIDEO_HEIGHTS) {
    const match = progressive
      .filter((f) => (f.height ?? 0) <= height)
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0))[0];

    if (match) {
      out[`mp4-${height}`] = {
        url: match.url,
        sizeBytes: match.filesize ?? match.filesize_approx ?? null,
      };
    }
  }

  return out;
}

/**
 * Maps each MP3 rung onto the closest audio-only stream. These are typically
 * m4a/opus rather than true MP3 — CholeyTube labels them by target bitrate.
 * Add a transcode step here if you need real MP3 containers.
 */
function pickAudio(formats) {
  const out = {};

  const audioOnly = formats
    .filter((f) => f.url && f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"))
    .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0));

  if (audioOnly.length === 0) return out;

  for (const target of AUDIO_BITRATES) {
    const match =
      audioOnly.find((f) => (f.abr ?? 0) <= target) ?? audioOnly[audioOnly.length - 1];

    if (match) {
      out[`mp3-${target}`] = {
        url: match.url,
        sizeBytes: match.filesize ?? match.filesize_approx ?? null,
      };
    }
  }

  return out;
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, service: "choleytube-resolver" });
  }

  if (req.method !== "POST" || !req.url?.startsWith("/resolve")) {
    return send(res, 404, { error: "Not found" });
  }

  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    return send(res, 401, { error: "Unauthorized" });
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 8_192) req.destroy();
  });

  req.on("end", async () => {
    let url;
    try {
      url = JSON.parse(raw).url;
    } catch {
      return send(res, 400, { error: "Body must be JSON" });
    }

    if (typeof url !== "string" || !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url)) {
      return send(res, 400, { error: "A YouTube URL is required" });
    }

    try {
      const info = await probe(url);
      const merged = { ...pickVideo(info.formats ?? []), ...pickAudio(info.formats ?? []) };

      const formats = Object.entries(merged).map(([id, value]) => ({
        id,
        kind: id.startsWith("mp4") ? "video" : "audio",
        url: value.url,
        sizeBytes: value.sizeBytes,
      }));

      console.log(`[resolve] ${info.title ?? url} -> ${formats.length} formats`);
      send(res, 200, { title: info.title, duration: info.duration, formats });
    } catch (error) {
      console.error("[resolve] failed:", error.message);
      send(res, 502, { error: "Extraction failed", detail: error.message });
    }
  });
});

server.listen(PORT, () => {
  console.log(`CholeyTube resolver listening on http://127.0.0.1:${PORT}/resolve`);
  console.log(`Using yt-dlp binary: ${YTDLP}`);
});
