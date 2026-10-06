"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NormalisedFormat = {
  id: string;
  label: string;
  ext: string;
  height?: number;
  fps?: number;
  filesize?: number;
  approxSize?: string;
  kind: "video" | "audio" | "video-only" | "audio-only";
};

type VideoInfo = {
  id: string;
  title: string;
  uploader: string;
  channel: string;
  duration: number;
  durationLabel: string;
  thumbnail: string;
  webpage_url: string;
  formats: NormalisedFormat[];
};

const SAMPLE_URLS = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/jNQXAC9IVRw",
];

function isValidUrl(value: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Downloader() {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fetchVideo = useCallback(async (rawUrl: string) => {
    setError(null);
    setInfo(null);
    setSelected(null);
    setDownloadStatus(null);

    if (!rawUrl.trim()) {
      setError("Paste a video URL to get started.");
      return;
    }
    if (!isValidUrl(rawUrl.trim())) {
      setError("That doesn't look like a valid http(s) URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl.trim() }),
      });
      const data = (await res.json()) as { info?: VideoInfo; error?: string };
      if (!res.ok || !data.info) {
        throw new Error(data.error || "Failed to fetch video info.");
      }
      setInfo(data.info);
      // Default to first non-audio option if available.
      const firstVideo = data.info.formats.find((f) => f.kind !== "audio");
      setSelected(firstVideo?.id ?? data.info.formats[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      fetchVideo(url);
    },
    [url, fetchVideo]
  );

  const selectedFormat = useMemo(
    () => info?.formats.find((f) => f.id === selected) ?? null,
    [info, selected]
  );

  const downloadUrl = useMemo(() => {
    if (!info || !selectedFormat) return null;
    const params = new URLSearchParams({
      url: info.webpage_url || url,
      format: selectedFormat.id,
      kind: selectedFormat.kind,
      title: info.title,
    });
    if (selectedFormat.height) params.set("height", String(selectedFormat.height));
    return `/api/download?${params.toString()}`;
  }, [info, selectedFormat, url]);

  const triggerDownload = useCallback(() => {
    if (!downloadUrl || !info || !selectedFormat) return;
    setDownloadStatus("Preparing your download…");
    // Use a hidden anchor so the browser handles the streamed response with a filename.
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => setDownloadStatus(null), 4000);
  }, [downloadUrl, info, selectedFormat]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Hero / Input */}
      <section className="text-center pt-6 sm:pt-10 pb-6">
        <span className="pill pill-accent">✨ Powered by yt-dlp</span>
        <h1 className="mt-4 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
          yoink any video. <br className="hidden sm:block" />
          <span style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            paste. pick. download.
          </span>
        </h1>
        <p className="mt-4 text-[color:var(--fg-muted)] max-w-xl mx-auto">
          A clean, ad-free downloader for YouTube, X/Twitter, Instagram, TikTok and 1,800+ sites.
          Files stream straight to your device — nothing is stored on our servers.
        </p>
      </section>

      <form onSubmit={onSubmit} className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="url"
            className="input"
            placeholder="https://youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            inputMode="url"
            aria-label="Video URL"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="spinner" aria-hidden /> : null}
          {loading ? "Fetching…" : "Yoink"}
        </button>
      </form>

      {error ? (
        <div className="alert alert-error mt-4" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      ) : null}

      {!info && !loading && !error ? (
        <div className="mt-4 text-center">
          <p className="text-[color:var(--fg-dim)] text-sm mb-2">Try one of these:</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {SAMPLE_URLS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => {
                  setUrl(s);
                  fetchVideo(s);
                }}
              >
                <span className="font-mono text-xs truncate max-w-[16rem]">{s}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {info ? (
        <section className="card mt-6 p-5 sm:p-6">
          <div className="grid sm:grid-cols-[280px_1fr] gap-5 sm:gap-6">
            <div>
              <div className="thumb">
                {info.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={info.thumbnail} alt={info.title} loading="lazy" />
                ) : null}
                <span className="thumb-duration">{info.durationLabel}</span>
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold leading-snug break-words">
                {info.title}
              </h2>
              <p className="mt-1 text-[color:var(--fg-muted)] text-sm">
                {info.channel} · {info.uploader}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="pill">⏱ {info.durationLabel}</span>
                <span className="pill">{info.formats.length} formats</span>
                {selectedFormat ? (
                  <span className="pill pill-accent">→ {selectedFormat.label}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm uppercase tracking-[0.08em] text-[color:var(--fg-muted)]">
              Pick a format
            </h3>
            {selectedFormat?.approxSize ? (
              <span className="text-xs text-[color:var(--fg-muted)]">
                ~ {selectedFormat.approxSize}
              </span>
            ) : null}
          </div>

          <div className="fmt-list">
            {info.formats.map((f) => {
              const isSelected = f.id === selected;
              return (
                <button
                  type="button"
                  key={f.id}
                  className={`fmt ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelected(f.id)}
                  aria-pressed={isSelected}
                >
                  <span className="fmt-label">
                    <span className="fmt-title">{f.label}</span>
                    <span className="fmt-sub">
                      {f.kind === "audio"
                        ? "Audio · MP3"
                        : f.kind === "video-only"
                        ? "Video only · merged with best audio → MP4"
                        : f.kind === "video"
                        ? "Video + audio · MP4"
                        : "Audio"}
                      {f.approxSize ? ` · ~ ${f.approxSize}` : ""}
                    </span>
                  </span>
                  <span className="fmt-check" aria-hidden>
                    {isSelected ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="text-xs text-[color:var(--fg-muted)]">
              {downloadStatus ? (
                <span className="dot-pulse" aria-live="polite">
                  <span /><span /><span />
                  <span className="ml-2">{downloadStatus}</span>
                </span>
              ) : (
                <span>
                  Tip: high-res formats are merged from separate video + audio streams using ffmpeg.
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedFormat}
              onClick={triggerDownload}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </button>
          </div>
        </section>
      ) : null}

      {!info && loading ? (
        <div className="card mt-6 p-10 text-center">
          <div className="dot-pulse justify-center">
            <span /><span /><span />
          </div>
          <p className="mt-3 text-sm text-[color:var(--fg-muted)]">
            Talking to yt-dlp… this can take a few seconds on first use while the binary warms up.
          </p>
        </div>
      ) : null}
    </div>
  );
}
