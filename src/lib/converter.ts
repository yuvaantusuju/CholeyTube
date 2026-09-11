// Talks to the same Cloudflare Worker that powers y2mate.gs.
// The worker only accepts requests that look like they come from the
// y2mate.gs front-end (matching Referer + Origin + apiKey headers).

const WORKER_BASE =
  "https://fancy-sea-5d3d.holy-breeze-fec5.workers.dev";

const ETACLOUD_HOMEPAGE = "https://etacloud.org/new/";
const Y2MATE_REFERER = "https://y2mate.gs/";
const Y2MATE_ORIGIN = "https://y2mate.gs";
const API_KEY = "e4b503d6ae10c35b1d3ee822c807d2f5";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function y2mateHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "User-Agent": BROWSER_UA,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: Y2MATE_REFERER,
    Origin: Y2MATE_ORIGIN,
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "X-Api-Key": API_KEY,
    ...extra,
  };
}

export type Format = "mp3" | "mp4";

export type ConverterInitResult =
  | {
      ok: true;
      title: string;
      progressUrl: string;
      downloadUrl: string;
    }
  | {
      ok: false;
      code: number;
      error: string;
    };

const ERROR_MESSAGES: Record<number, string> = {
  1: "Invalid video. Make sure the link points to a real YouTube video.",
  2: "Video is private or has been removed.",
  3: "YouTube rejected the request. Try again in a moment.",
  5: "The conversion service is currently unavailable.",
  12: "The conversion service rejected our request (anti-bot). Try again.",
  215: "YouTube refused the request (rate-limited or region-locked).",
  403: "Access denied by YouTube.",
  429: "Too many requests. Please wait a moment and try again.",
  502: "The conversion service is down. Try again shortly.",
  643: "Video is age-restricted and cannot be downloaded.",
  644: "Video is region-locked and not available in our server's region.",
  648: "Video uses protected streams and can't be converted.",
};

function explainError(code: number): string {
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (code >= 100 && code < 600) {
    return `The conversion service returned an error (code ${code}).`;
  }
  return `Unexpected error from the conversion service (code ${code}).`;
}

// The "progressURL" and "downloadURL" returned by the worker are actually
// already-formed URLs that point back to the same worker (e.g. ?m=p&u=...).
// They must be called as-is with a cache-busting `&_=<ts>` appended.
function decodeWorkerUrl(encoded: string): string {
  return encoded;
}

export async function initConversion(
  videoId: string,
  format: Format,
): Promise<ConverterInitResult> {
  const url =
    `${WORKER_BASE}/?m=i` +
    `&v=${encodeURIComponent(videoId)}` +
    `&f=${encodeURIComponent(format)}` +
    `&_=${Date.now()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      // The worker only accepts requests that mimic the y2mate.gs origin.
      headers: y2mateHeaders(),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      code: 502,
      error:
        err instanceof Error
          ? `Couldn't reach the conversion service: ${err.message}`
          : "Couldn't reach the conversion service.",
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      code: 502,
      error: "The conversion service returned a malformed response.",
    };
  }

  const data = body as {
    status?: string;
    error?: number;
    title?: string;
    progressURL?: string;
    downloadURL?: string;
  };

  if (data.error && data.error > 0) {
    return { ok: false, code: data.error, error: explainError(data.error) };
  }

  if (data.status === "download" && data.downloadURL) {
    return {
      ok: true,
      title: data.title ?? "video",
      progressUrl: "",
      downloadUrl: data.downloadURL,
    };
  }

  if (data.status === "progress" && data.progressURL && data.downloadURL) {
    return {
      ok: true,
      title: data.title ?? "video",
      progressUrl: decodeWorkerUrl(data.progressURL),
      downloadUrl: decodeWorkerUrl(data.downloadURL),
    };
  }

  return {
    ok: false,
    code: 502,
    error: "The conversion service gave an unexpected response.",
  };
}

export type ProgressResult =
  | {
      ok: true;
      progress: number; // 0=checking, 1=extracting, 2=converting, 3=done
      title: string;
      downloadUrl: string;
      done: boolean;
    }
  | {
      ok: false;
      code: number;
      error: string;
    };

export async function checkProgress(
  progressUrl: string,
  knownTitle: string,
): Promise<ProgressResult> {
  // The y2mate front-end appends &_=<ts> for cache-busting.
  const url = progressUrl.includes("?")
    ? `${progressUrl}&_=${Date.now()}`
    : `${progressUrl}?_=${Date.now()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: y2mateHeaders(),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      code: 502,
      error:
        err instanceof Error
          ? `Progress check failed: ${err.message}`
          : "Progress check failed.",
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      code: 502,
      error: "Progress check returned a malformed response.",
    };
  }

  const data = body as {
    status?: string;
    error?: number;
    title?: string;
    progress?: number;
    downloadURL?: string;
  };

  if (data.error && data.error > 0) {
    return { ok: false, code: data.error, error: explainError(data.error) };
  }

  if (data.status === "download" && data.downloadURL) {
    return {
      ok: true,
      progress: 3,
      title: data.title ?? knownTitle,
      downloadUrl: decodeWorkerUrl(data.downloadURL),
      done: true,
    };
  }

  if (typeof data.progress === "number") {
    return {
      ok: true,
      progress: data.progress,
      title: data.title ?? knownTitle,
      downloadUrl: "",
      done: false,
    };
  }

  return {
    ok: false,
    code: 502,
    error: "Progress check gave an unexpected response.",
  };
}

export async function streamFromUrl(
  downloadUrl: string,
  format: Format,
  title: string,
): Promise<Response> {
  // Follow redirects to the actual file host (etacloud.org).
  const res = await fetch(downloadUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: ETACLOUD_HOMEPAGE,
      Origin: "https://etacloud.org",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
    },
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    throw new Error(
      `Download host returned ${res.status}. The file may have expired — try again.`,
    );
  }

  // Build a safe filename from the title.
  const safeTitle =
    title
      .replace(/[^\w\s\-()\[\]]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 80) || `choleytube_${Date.now()}`;

  // Pass through the upstream headers, but override Content-Disposition so
  // the browser saves it with a friendly filename.
  const headers = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);
  const cl = res.headers.get("content-length");
  if (cl) headers.set("Content-Length", cl);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${safeTitle}.${format}"; filename*=UTF-8''${encodeURIComponent(
      `${safeTitle}.${format}`,
    )}`,
  );
  headers.set("Cache-Control", "no-store");

  return new Response(res.body, { status: 200, headers });
}
