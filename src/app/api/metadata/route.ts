import { NextResponse } from "next/server";
import ytDlp, { type YtResponse } from "yt-dlp-exec";

export const dynamic = "force-dynamic";

interface PlaylistEntry {
  id?: string;
  title?: string;
  thumbnail?: string;
  thumbnails?: { url: string }[];
  duration?: number;
  uploader?: string;
  channel?: string;
  creator?: string;
}

interface PlaylistResponse {
  _type?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  creator?: string;
  webpage_url?: string;
  thumbnail?: string;
  thumbnails?: { url: string }[];
  entries?: PlaylistEntry[];
}

interface MetadataPayload {
  url: string;
}

function sanitizeUrl(url: string): string {
  return url.trim().replace(/^<|>$/g, "");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MetadataPayload;
    let { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid YouTube URL." },
        { status: 400 }
      );
    }

    url = sanitizeUrl(url);

    const ytPattern =
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/.+/i;
    if (!ytPattern.test(url)) {
      return NextResponse.json(
        { error: "That doesn't look like a valid YouTube link." },
        { status: 400 }
      );
    }

    const result = (await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      skipDownload: true,
      flatPlaylist: false,
    })) as YtResponse & PlaylistResponse;

    if (!result) {
      return NextResponse.json(
        { error: "Could not retrieve video metadata." },
        { status: 422 }
      );
    }

    // Playlist?
    if (result._type && result._type === "playlist") {
      const entries = (result.entries || []).filter(Boolean);
      if (entries.length === 0) {
        return NextResponse.json(
          { error: "Playlist is empty or private." },
          { status: 422 }
        );
      }
      const firstEntry = entries[0];
      const plThumb =
        firstEntry.thumbnail ||
        firstEntry.thumbnails?.slice(-1)[0]?.url ||
        result.thumbnail ||
        "";
      return NextResponse.json({
        ok: true,
        isPlaylist: true,
        id: "",
        title: result.title || "YouTube Playlist",
        channel: result.uploader || result.channel || result.creator || "Unknown",
        thumbnail: plThumb,
        entriesCount: entries.length,
        duration: entries.reduce((acc, e) => acc + (e.duration || 0), 0),
        url: result.webpage_url || url,
      });
    }

    const thumb =
      result.thumbnail ||
      result.thumbnails?.slice(-1)[0]?.url ||
      (result.id ? `https://i.ytimg.com/vi/${result.id}/hqdefault.jpg` : "");

    return NextResponse.json({
      ok: true,
      isPlaylist: false,
      id: result.id || "",
      title: result.title || result.fulltitle || "Untitled Video",
      channel:
        result.uploader || result.channel || result.creator || "Unknown Channel",
      thumbnail: thumb,
      duration: result.duration || 0,
      description: result.description || "",
      viewCount: result.view_count || 0,
      url: result.webpage_url || url,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[metadata] error:", message);
    return NextResponse.json(
      {
        error:
          "Failed to fetch video metadata. The link may be private, age-restricted, removed, or invalid.",
      },
      { status: 500 }
    );
  }
}
