import axios, { AxiosError, type AxiosInstance } from "axios";

/**
 * Shared outbound HTTP client.
 *
 * Every upstream call is made with browser-like headers (User-Agent, Accept,
 * Accept-Language, Referer/Origin) because most media metadata hosts reject
 * default server-side agents outright.
 */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const DEFAULT_TIMEOUT_MS = 12_000;

export function browserHeaders(referer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };

  if (referer) {
    headers.Referer = referer;
    try {
      headers.Origin = new URL(referer).origin;
    } catch {
      /* referer may be a bare origin already */
    }
  }

  return headers;
}

export function createClient(baseURL?: string, referer?: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: browserHeaders(referer),
    // Never throw on 4xx – the callers inspect the payload themselves.
    validateStatus: () => true,
    maxRedirects: 5,
  });
}

export function isTimeout(error: unknown): boolean {
  const err = error as AxiosError | undefined;
  return err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT";
}

export function describeAxiosError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (isTimeout(error)) return "Upstream request timed out.";
    if (error.response) return `Upstream responded with ${error.response.status}.`;
    return error.message || "Upstream request failed.";
  }
  return error instanceof Error ? error.message : "Unknown upstream failure.";
}
