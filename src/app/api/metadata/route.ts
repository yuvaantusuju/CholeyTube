import { NextRequest } from "next/server";
import { fetchVideoInfo, friendlyError, isYouTubeUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();

  if (!url) {
    return Response.json(
      { error: "Please paste a YouTube link first." },
      { status: 400 },
    );
  }

  if (!isYouTubeUrl(url)) {
    return Response.json(
      { error: "That doesn't look like a valid YouTube link." },
      { status: 400 },
    );
  }

  try {
    const info = await fetchVideoInfo(url);
    return Response.json({ info });
  } catch (err) {
    return Response.json({ error: friendlyError(err) }, { status: 422 });
  }
}
