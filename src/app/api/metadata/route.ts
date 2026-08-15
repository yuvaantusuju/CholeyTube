export const runtime = 'edge';
import { NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

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

    if (!ytdl.validateURL(url)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL." },
        { status: 400 }
      );
    }

    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    });

    const videoDetails = info.videoDetails;
    const formats = info.formats;

    const thumb =
      videoDetails.thumbnails?.slice(-1)[0]?.url ||
      (videoDetails.videoId
        ? `https://i.ytimg.com/vi/${videoDetails.videoId}/hqdefault.jpg`
        : "");

    return NextResponse.json({
      ok: true,
      isPlaylist: false,
      id: videoDetails.videoId || "",
      title: videoDetails.title || "Untitled Video",
      channel:
        videoDetails.author?.name || videoDetails.ownerChannelName || "Unknown Channel",
      thumbnail: thumb,
      duration: parseInt(videoDetails.lengthSeconds || "0", 10),
      description: videoDetails.Description || "",
      viewCount: parseInt(videoDetails.viewCount || "0", 10),
      url: videoDetails.video_url || url,
      formats: formats.map((f) => ({
        itag: f.itag,
        mimeType: f.mimeType,
        quality: f.qualityLabel || f.quality,
        hasVideo: f.hasVideo,
        hasAudio: f.hasAudio,
        contentLength: f.contentLength,
        bitrate: f.bitrate,
      })),
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