import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC signing for proxied media URLs.
 *
 * The streaming proxy (/api/download/stream) will only fetch URLs that this
 * server itself produced. Without this, the endpoint would be an open proxy
 * that anyone could point at arbitrary hosts.
 */

function secret(): string {
  return (
    process.env.STREAM_SIGNING_SECRET ??
    process.env.RESOLVER_TOKEN ??
    "choleytube-dev-signing-secret"
  );
}

export function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function verify(value: string, signature: string): boolean {
  const expected = Buffer.from(sign(value));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function b64urlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function b64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

/** Builds a same-origin, signed, force-download URL for a remote media file. */
export function buildProxyUrl(directUrl: string, fileName: string): string {
  const encoded = b64urlEncode(directUrl);
  const params = new URLSearchParams({
    u: encoded,
    s: sign(encoded),
    n: fileName,
  });
  return `/api/download/stream?${params.toString()}`;
}

/**
 * Signed URL for on-the-fly muxing of a separate video track and audio track
 * into one downloadable MP4.
 */
export function buildMuxUrl(videoUrl: string, audioUrl: string, fileName: string): string {
  const v = b64urlEncode(videoUrl);
  const a = b64urlEncode(audioUrl);
  const params = new URLSearchParams({
    v,
    a,
    s: sign(`${v}.${a}`),
    n: fileName,
  });
  return `/api/download/mux?${params.toString()}`;
}
