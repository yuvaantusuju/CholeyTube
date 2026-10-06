import { NextRequest, NextResponse } from "next/server";
import { fetchInfo, isSupportedUrl } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { url?: string } = {};
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = (body.url ?? "").trim();

  if (!url) {
    return NextResponse.json({ error: "Please paste a video URL." }, { status: 400 });
  }
  if (!isSupportedUrl(url)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid http(s) URL." },
      { status: 400 }
    );
  }

  try {
    const info = await fetchInfo(url);
    return NextResponse.json({ info });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch video info.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
