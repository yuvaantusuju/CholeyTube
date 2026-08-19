import { NextResponse, type NextRequest } from "next/server";

import { BROWSER_UA } from "@/lib/http";
import { b64urlDecode, verify } from "@/lib/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streaming download proxy.
 *
 * Browsers ignore the <a download> attribute for cross-origin URLs, so a direct
 * link just opens the media in a tab. This route pipes the remote file through
 * our own origin and attaches `Content-Disposition: attachment`, which is what
 * actually makes the browser save a file.
 *
 * Safety: only URLs signed by this server are accepted (see lib/sign.ts), and
 * private / loopback address ranges are rejected to prevent SSRF.
 */

const BLOCKED_HOST = /^(localhost|0\.0\.0\.0|\[?::1\]?|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;

function bad(message: string, status: number) {
  return NextResponse.json({ ok: false, error: { message } }, { status });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const encoded = params.get("u");
  const signature = params.get("s");
  const fileName = sanitiseFileName(params.get("n") ?? "choleytube-download");

  if (!encoded || !signature) {
    return bad("Missing signed download parameters.", 400);
  }

  if (!verify(encoded, signature)) {
    return bad("Invalid or expired download signature.", 403);
  }

  let target: URL;
  try {
    target = new URL(b64urlDecode(encoded));
  } catch {
    return bad("Malformed target URL.", 400);
  }

  if (!/^https?:$/.test(target.protocol) || BLOCKED_HOST.test(target.hostname)) {
    return bad("Target host is not permitted.", 403);
  }

  // Forward Range so the browser can resume / seek large files.
  const range = request.headers.get("range");

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: `${target.protocol}//${target.host}/`,
        ...(range ? { Range: range } : {}),
      },
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    return bad("Could not reach the media host.", 502);
  }

  if (!upstream.ok && upstream.status !== 206) {
    const reason =
      upstream.status === 403
        ? "YouTube refused this transfer (403). Its media URLs are bound to the extracting IP, " +
          "and Google blocks delivery to most cloud/datacenter ranges. Running CholeyTube on a " +
          "home or residential connection resolves this."
        : `Media host responded with ${upstream.status}.`;
    return bad(reason, 502);
  }

  if (!upstream.body) {
    return bad("Media host returned an empty response.", 502);
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "Content-Disposition": contentDisposition(fileName),
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });

  for (const header of ["content-length", "content-range"]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

function sanitiseFileName(raw: string): string {
  const cleaned = raw
    .replace(/[/\\?%*:|"<>\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "choleytube-download";
}

/** RFC 5987 encoding so non-ASCII titles survive the header. */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
