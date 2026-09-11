export type ParsedYouTube = {
  ok: true;
  videoId: string;
  canonicalUrl: string;
} | {
  ok: false;
  error: string;
};

const ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeUrl(input: string): ParsedYouTube {
  if (!input || typeof input !== "string") {
    return { ok: false, error: "Please enter a YouTube URL or video ID." };
  }

  const trimmed = input.trim();

  // Bare 11-char video ID
  if (ID_REGEX.test(trimmed)) {
    return {
      ok: true,
      videoId: trimmed,
      canonicalUrl: `https://www.youtube.com/watch?v=${trimmed}`,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  const extractFromQuery = (q: string | null) => {
    if (!q) return null;
    const m = q.match(/^[a-zA-Z0-9_-]{11}$/);
    return m ? m[0] : null;
  };

  if (host === "youtu.be") {
    const id = extractFromQuery(url.pathname.replace(/^\//, "").split("/")[0]);
    if (id) {
      return {
        ok: true,
        videoId: id,
        canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      };
    }
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    const v = url.searchParams.get("v");
    if (v && ID_REGEX.test(v)) {
      return {
        ok: true,
        videoId: v,
        canonicalUrl: `https://www.youtube.com/watch?v=${v}`,
      };
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) =>
      ["shorts", "embed", "live", "v"].includes(p),
    );
    if (idx >= 0 && parts[idx + 1] && ID_REGEX.test(parts[idx + 1])) {
      const id = parts[idx + 1];
      return {
        ok: true,
        videoId: id,
        canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      };
    }
  }

  return {
    ok: false,
    error: "We couldn't find a YouTube video ID in that link.",
  };
}

export type VideoMetadata = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  canonicalUrl: string;
  embedUrl: string;
};

export type MetadataResult =
  | { ok: true; data: VideoMetadata }
  | { ok: false; error: string };

export async function fetchVideoMetadata(
  videoId: string,
  canonicalUrl: string,
): Promise<MetadataResult> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    canonicalUrl,
  )}&format=json`;

  try {
    const res = await fetch(oembedUrl, {
      next: { revalidate: 60 * 30 },
      headers: { "User-Agent": "CholeyTube/1.0" },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return {
          ok: false,
          error:
            "YouTube blocked metadata lookup for this video. It may be private, age-restricted, or region-locked.",
        };
      }
      return {
        ok: false,
        error: `YouTube responded with status ${res.status}.`,
      };
    }

    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    return {
      ok: true,
      data: {
        videoId,
        title: data.title ?? "Untitled video",
        author: data.author_name ?? "Unknown channel",
        thumbnail:
          data.thumbnail_url ??
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        canonicalUrl,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Couldn't reach YouTube: ${err.message}`
          : "Couldn't reach YouTube.",
    };
  }
}

export type DownloadFormat = "mp3" | "mp4";

export type DownloadOption = {
  id: string;
  format: DownloadFormat;
  label: string;
  description: string;
  badge?: string;
};

// The real y2mate.gs only exposes two options: MP3 and MP4.
export function buildDownloadOptions(): DownloadOption[] {
  return [
    {
      id: "mp4",
      format: "mp4",
      label: "MP4 — up to 720p",
      description:
        "Video + audio in one file. Plays on every device, ready to share or save.",
      badge: "Video",
    },
    {
      id: "mp3",
      format: "mp3",
      label: "MP3 — 192 kbps",
      description:
        "Audio-only track, the same default quality y2mate.gs ships with.",
      badge: "Audio",
    },
  ];
}

export function buildWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function buildThumbnails(videoId: string) {
  return {
    max: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    sd: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    hq: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    mq: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  };
}
