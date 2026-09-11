import { NextRequest, NextResponse } from "next/server";
import {
  parseYouTubeUrl,
  fetchVideoMetadata,
  buildDownloadOptions,
  buildThumbnails,
} from "@/lib/youtube";

export const dynamic = "force-dynamic";

type Body = { url?: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const url = body.url;
  if (!url) {
    return NextResponse.json(
      { ok: false, error: "Missing 'url' field." },
      { status: 400 },
    );
  }

  const parsed = parseYouTubeUrl(url);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: 400 },
    );
  }

  const meta = await fetchVideoMetadata(parsed.videoId, parsed.canonicalUrl);
  if (!meta.ok) {
    return NextResponse.json(
      { ok: false, error: meta.error },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    video: meta.data,
    options: buildDownloadOptions(),
    thumbnails: buildThumbnails(parsed.videoId),
  });
}
