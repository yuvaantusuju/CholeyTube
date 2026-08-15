export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

export const dynamic = "force-dynamic";

type Mode = "mp3" | "mp4";

interface DownloadPayload {
  url: string;
  mode: Mode;
  quality?: string;
  resolution?: string;
  format?: string;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "download";
}

function isValidYtUrl(u: string): boolean {
  return ytdl.validateURL(u);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DownloadPayload;
    const url = body.url?.trim();
    const mode: Mode = body.mode === "mp4" ? "mp4" : "mp3";

    if (!url || !isValidYtUrl(url)) {
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

    const safeTitle = sanitizeFilename(
      videoDetails.title || (mode === "mp3" ? "youtube-audio" : "youtube-video")
    );

    let selectedFormat;
    let expectedExt: string;
    let contentType: string;

    if (mode === "mp3") {
      const audioFormats = ytdl.filterFormats(formats, "audioonly");
      if (audioFormats.length === 0) {
        return NextResponse.json(
          { error: "No audio formats available." },
          { status: 422 }
        );
      }

      const quality = body.quality || "128";
      selectedFormat = ytdl.chooseFormat(audioFormats, {
        quality: quality === "320" ? "highestaudio" : quality === "192" ? "highestaudio" : "highestaudio",
      });

      expectedExt = "mp3";
      contentType = "audio/mpeg";
    } else {
      const videoFormats = ytdl.filterFormats(formats, "videoandaudio");
      if (videoFormats.length === 0) {
        return NextResponse.json(
          { error: "No video+audio formats available." },
          { status: 422 }
        );
      }

      const resolution = body.resolution || "720";
      const height = parseInt(resolution, 10);
      selectedFormat = ytdl.chooseFormat(videoFormats, {
        quality: height >= 1080 ? "highestvideo" : height >= 720 ? "720p" : "480p",
      });

      expectedExt = "mp4";
      contentType = "video/mp4";
    }

    if (!selectedFormat) {
      return NextResponse.json(
        { error: "Could not select appropriate format." },
        { status: 422 }
      );
    }

    const stream = ytdl.downloadFromInfo(info, {
      format: selectedFormat,
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    });

    const finalName = `${safeTitle}.${expectedExt}`;

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(readableStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(finalName)}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: unknown) {
    console.error("[download] error:", err);
    const message = err instanceof Error ? err.message : "Unknown download error";
    return NextResponse.json(
      { error: `Download failed: ${message.slice(0, 500)}` },
      { status: 500 }
    );
  }
}