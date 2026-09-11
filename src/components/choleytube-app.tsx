"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DownloadOption,
  VideoMetadata,
} from "@/lib/youtube";

type AnalyzeResponse = {
  ok: true;
  video: VideoMetadata;
  options: DownloadOption[];
  thumbnails: { max: string; sd: string; hq: string; mq: string };
};

type AnalyzeError = { ok: false; error: string };

type Favorite = {
  videoId: string;
  videoTitle: string;
  videoAuthor: string | null;
  videoThumbnail: string | null;
  sourceUrl: string;
  createdAt: number;
};

type HistoryItem = {
  videoId: string;
  videoTitle: string;
  format: "mp3" | "mp4";
  createdAt: number;
};

type JobState = {
  jobId: string;
  status: "checking" | "extracting" | "converting" | "ready" | "error";
  progress: number;
  title: string;
  format: "mp3" | "mp4";
  error?: string;
};

const SAMPLE_URLS = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/jNQXAC9IVRw",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
];

const STATUS_LABEL: Record<JobState["status"], string> = {
  checking: "Checking the video",
  extracting: "Extracting audio/video streams",
  converting: "Converting on the server",
  ready: "Your file is ready",
  error: "Something went wrong",
};

const FAV_KEY = "choleytube:favorites";
const HIST_KEY = "choleytube:history";

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — ignore */
  }
}

export default function CholeyTubeApp() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<"mp3" | "mp4">("mp4");
  const [isFavorite, setIsFavorite] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [polling, setPolling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    setFavorites(loadLocal<Favorite[]>(FAV_KEY, []));
    setHistory(loadLocal<HistoryItem[]>(HIST_KEY, []));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  // Cleanup the poll when unmounting.
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleAnalyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!url.trim()) {
      setError("Paste a YouTube link first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setIsFavorite(false);
    setJob(null);
    stopPolling();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as AnalyzeResponse | AnalyzeError;
      if (!data.ok) {
        setError(data.error);
      } else {
        setResult(data);
        setFavorites((curr) => {
          const fav = curr.find((f) => f.videoId === data.video.videoId);
          setIsFavorite(Boolean(fav));
          return curr;
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const startConversion = async () => {
    if (!result) return;
    setDownloading(true);
    setError(null);
    setJob(null);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.video.canonicalUrl,
          format: selectedFormat,
          videoTitle: result.video.title,
        }),
      });
      const data = (await res.json()) as
        | {
            ok: true;
            jobId: string;
            status: JobState["status"];
            progress: number;
            title: string;
            format: "mp3" | "mp4";
            error?: string;
          }
        | AnalyzeError;
      if (!data.ok) {
        setError(data.error);
        setDownloading(false);
        return;
      }
      setJob({
        jobId: data.jobId,
        status: data.status,
        progress: data.progress,
        title: data.title,
        format: data.format,
        error: data.error,
      });
      if (data.status === "ready") {
        setDownloading(false);
        return;
      }
      if (data.status === "error") {
        setError(data.error ?? "The conversion failed.");
        setDownloading(false);
        return;
      }

      // Poll for progress.
      setPolling(true);
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(
            `/api/download?jobId=${encodeURIComponent(data.jobId)}`,
          );
          const pollData = (await pollRes.json()) as
            | {
                ok: true;
                jobId: string;
                status: JobState["status"];
                progress: number;
                title: string;
                format: "mp3" | "mp4";
                error?: string;
              }
            | AnalyzeError;
          if (!pollData.ok) {
            stopPolling();
            setError(pollData.error);
            setDownloading(false);
            return;
          }
          setJob({
            jobId: pollData.jobId,
            status: pollData.status,
            progress: pollData.progress,
            title: pollData.title,
            format: pollData.format,
            error: pollData.error,
          });
          if (pollData.status === "ready") {
            stopPolling();
            setDownloading(false);
            // Add to history
            if (result) {
              const entry: HistoryItem = {
                videoId: result.video.videoId,
                videoTitle: pollData.title || result.video.title,
                format: pollData.format,
                createdAt: Date.now(),
              };
              setHistory((curr) => {
                const next = [entry, ...curr].slice(0, 30);
                saveLocal(HIST_KEY, next);
                return next;
              });
            }
          } else if (pollData.status === "error") {
            stopPolling();
            setError(pollData.error ?? "The conversion failed.");
            setDownloading(false);
          }
        } catch (err) {
          stopPolling();
          setError(
            err instanceof Error
              ? `Polling error: ${err.message}`
              : "Polling error.",
          );
          setDownloading(false);
        }
      }, 2500);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't start the conversion: ${err.message}`
          : "Couldn't start the conversion.",
      );
      setDownloading(false);
    }
  };

  const handleSaveFile = () => {
    if (!job || job.status !== "ready") return;
    setDownloadToast("Starting your download…");
    window.location.href = `/api/file?jobId=${encodeURIComponent(job.jobId)}`;
    setTimeout(() => setDownloadToast(null), 3000);
  };

  const toggleFavorite = () => {
    if (!result) return;
    const { video } = result;
    setFavorites((curr) => {
      const exists = curr.some((f) => f.videoId === video.videoId);
      let next: Favorite[];
      if (exists) {
        next = curr.filter((f) => f.videoId !== video.videoId);
        setIsFavorite(false);
        setDownloadToast("Removed from favorites.");
      } else {
        const fav: Favorite = {
          videoId: video.videoId,
          videoTitle: video.title,
          videoAuthor: video.author,
          videoThumbnail: video.thumbnail,
          sourceUrl: video.canonicalUrl,
          createdAt: Date.now(),
        };
        next = [fav, ...curr].slice(0, 100);
        setIsFavorite(true);
        setDownloadToast("Saved to favorites!");
      }
      saveLocal(FAV_KEY, next);
      return next;
    });
    setTimeout(() => setDownloadToast(null), 2500);
  };

  const pickFavorite = (fav: Favorite) => {
    setUrl(fav.sourceUrl);
    setResult(null);
    setError(null);
    setJob(null);
    stopPolling();
    setTimeout(() => {
      void analyzeWith(fav.sourceUrl);
    }, 50);
  };

  const removeFavorite = (videoId: string) => {
    setFavorites((curr) => {
      const next = curr.filter((f) => f.videoId !== videoId);
      saveLocal(FAV_KEY, next);
      if (result && result.video.videoId === videoId) {
        setIsFavorite(false);
      }
      return next;
    });
  };

  const analyzeWith = async (targetUrl: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setJob(null);
    stopPolling();
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = (await res.json()) as AnalyzeResponse | AnalyzeError;
      if (!data.ok) {
        setError(data.error);
      } else {
        setResult(data);
        setFavorites((curr) => {
          const fav = curr.find((f) => f.videoId === data.video.videoId);
          setIsFavorite(Boolean(fav));
          return curr;
        });
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const copyEmbed = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.video.embedUrl);
      setDownloadToast("Embed URL copied to clipboard.");
      setTimeout(() => setDownloadToast(null), 2000);
    } catch {
      setDownloadToast("Couldn't copy — your browser blocked clipboard access.");
      setTimeout(() => setDownloadToast(null), 2500);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    saveLocal(HIST_KEY, []);
  };

  const filteredOptions = useMemo(() => {
    if (!result) return [];
    return result.options;
  }, [result]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-[var(--accent-red)] opacity-30 blur-3xl floaty" />
        <div
          className="absolute top-20 -right-32 h-96 w-96 rounded-full bg-[var(--accent-violet)] opacity-25 blur-3xl floaty"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[var(--accent-cyan)] opacity-15 blur-3xl floaty"
          style={{ animationDelay: "3s" }}
        />
      </div>

      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--accent-red)] to-[var(--accent-violet)] blur-md opacity-70" />
            <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent-red)] via-[var(--accent-pink)] to-[var(--accent-violet)] shadow-lg">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-white"
                fill="currentColor"
                aria-hidden
              >
                <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.3 5 12 5 12 5s-6.3 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.7 19 12 19 12 19s6.3 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <h1 className="text-xl font-bold tracking-tight">
                Choley<span className="gradient-text">Tube</span>
              </h1>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                yt downloader
              </span>
            </div>
            <p className="text-xs text-[var(--text-soft)]">
              MP3 & MP4 downloads powered by y2mate.gs
            </p>
          </div>
        </div>
        <div className="hidden gap-2 md:flex">
          <div className="chip">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-cyan)]" />
            MP3 · 192 kbps
          </div>
          <div className="chip">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-amber)]" />
            MP4 · up to 720p
          </div>
          <a
            href="https://y2mate.gs"
            target="_blank"
            rel="noopener noreferrer"
            className="chip hover:bg-white/10"
          >
            <span>↗</span> y2mate.gs
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {/* Hero */}
        <section className="mt-8 text-center md:mt-14">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-[var(--text-soft)] backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-red)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent-red)]" />
            </span>
            Free · No sign-up · No database · Runs in your browser
          </div>
          <h2 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Download any <span className="gradient-text">YouTube</span> video
            <br />
            as <span className="gradient-text">MP3</span> or{" "}
            <span className="gradient-text">MP4</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-[var(--text-soft)] md:text-lg">
            Paste a YouTube link, pick MP3 or MP4, and CholeyTube runs the
            conversion for you using the same backend as y2mate.gs. No
            accounts, no database, no tracking.
          </p>
        </section>

        {/* URL input */}
        <section className="mx-auto mt-10 max-w-3xl">
          <form
            onSubmit={handleAnalyze}
            className="glass-strong relative rounded-3xl p-2 shadow-2xl"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-soft)]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <input
                  type="text"
                  inputMode="url"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-2xl bg-white/[0.04] py-4 pl-14 pr-4 text-base text-white placeholder:text-[var(--text-soft)] outline-none ring-1 ring-white/10 transition focus:bg-white/[0.06] focus:ring-[var(--accent-pink)]/40"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="btn-primary flex items-center justify-center gap-2 rounded-2xl px-7 py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed pulse-glow"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                    Analyze
                  </>
                )}
              </button>
            </div>

            <div className="px-3 pb-2 pt-3 text-xs text-[var(--text-soft)]">
              <span className="opacity-70">Try a sample:</span>{" "}
              {SAMPLE_URLS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setUrl(s);
                  }}
                  className="mx-1 my-1 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  {i === 0 ? "Classic" : i === 1 ? "Short" : "Shorts URL"}
                </button>
              ))}
            </div>
          </form>

          {error && (
            <div className="fade-up mt-4 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-5 w-5 shrink-0"
                fill="currentColor"
              >
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z" />
              </svg>
              <div>
                <p className="font-medium text-red-100">Something went wrong</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}
        </section>

        {/* Loading skeleton */}
        {loading && (
          <section className="mx-auto mt-10 max-w-4xl fade-up">
            <div className="glass-strong rounded-3xl p-6">
              <div className="flex gap-5">
                <div className="shimmer h-32 w-56 shrink-0 rounded-2xl" />
                <div className="flex-1 space-y-3">
                  <div className="shimmer h-5 w-2/3 rounded" />
                  <div className="shimmer h-4 w-1/3 rounded" />
                  <div className="shimmer mt-4 h-10 w-40 rounded-full" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Result */}
        {result && !loading && (
          <section className="mx-auto mt-10 max-w-5xl fade-up">
            <VideoCard
              video={result.video}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onCopyEmbed={copyEmbed}
            />

            {/* Format picker — MP3 or MP4 */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {filteredOptions.map((opt) => {
                const active = selectedFormat === opt.format;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedFormat(opt.format);
                      setJob(null);
                      stopPolling();
                    }}
                    className={`group relative overflow-hidden rounded-3xl border p-6 text-left transition ${
                      active
                        ? "border-white/20 bg-gradient-to-br from-white/10 to-white/[0.02] shadow-2xl"
                        : "glass hover:bg-white/[0.06]"
                    }`}
                  >
                    {opt.badge && (
                      <span className="absolute right-5 top-5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
                        {opt.badge}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-12 w-12 place-items-center rounded-2xl text-base font-bold ${
                          opt.format === "mp4"
                            ? "bg-[var(--accent-violet)]/20 text-[var(--accent-cyan)]"
                            : "bg-[var(--accent-amber)]/20 text-[var(--accent-amber)]"
                        }`}
                      >
                        {opt.format.toUpperCase()}
                      </span>
                      <div>
                        <p className="text-lg font-bold">{opt.label}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-[var(--text-soft)]">
                      {opt.description}
                    </p>
                    {active && (
                      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[var(--accent-red)] via-[var(--accent-pink)] to-[var(--accent-violet)]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Convert CTA */}
            {!job && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <button
                  onClick={startConversion}
                  disabled={downloading}
                  className="btn-primary group inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-base disabled:opacity-50"
                >
                  {downloading ? (
                    <>
                      <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Starting conversion…
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                      </svg>
                      Convert to {selectedFormat.toUpperCase()}
                      <span className="opacity-70 transition group-hover:translate-x-0.5">
                        ↗
                      </span>
                    </>
                  )}
                </button>
                <p className="text-xs text-[var(--text-soft)]">
                  Runs the same conversion backend as{" "}
                  <a
                    href="https://y2mate.gs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    y2mate.gs
                  </a>
                  .
                </p>
              </div>
            )}

            {/* Job progress */}
            {job && (
              <div className="glass-strong mt-8 overflow-hidden rounded-3xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-cyan)]">
                      {job.format.toUpperCase()} conversion
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {job.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {STATUS_LABEL[job.status]}
                    </p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5">
                    {job.status === "ready" ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 text-[var(--accent-cyan)]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    ) : job.status === "error" ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 text-red-400"
                        fill="currentColor"
                      >
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z" />
                      </svg>
                    ) : (
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    )}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-[var(--text-soft)]">
                    <span>
                      {polling
                        ? "Working…"
                        : job.status === "ready"
                          ? "Complete"
                          : job.status}
                    </span>
                    <span>{Math.round((job.progress / 3) * 100)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--accent-red)] via-[var(--accent-pink)] to-[var(--accent-amber)] transition-all duration-500"
                      style={{ width: `${(job.progress / 3) * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-wider text-[var(--text-soft)]">
                    <Step
                      n={1}
                      active={job.progress >= 1}
                      current={job.progress === 1}
                      label="Check"
                    />
                    <Step
                      n={2}
                      active={job.progress >= 2}
                      current={job.progress === 2}
                      label="Extract"
                    />
                    <Step
                      n={3}
                      active={job.progress >= 3}
                      current={job.progress === 3}
                      label="Convert"
                    />
                  </div>
                </div>

                {job.status === "ready" && (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <button
                      onClick={handleSaveFile}
                      className="btn-primary inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-base"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                      </svg>
                      Download {job.format.toUpperCase()}
                    </button>
                    <p className="text-xs text-[var(--text-soft)]">
                      Saving{" "}
                      <span className="text-white">
                        {job.title}.{job.format}
                      </span>{" "}
                      to your device.
                    </p>
                  </div>
                )}

                {job.status === "error" && job.error && (
                  <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                    {job.error}
                  </div>
                )}

                {(job.status === "checking" ||
                  job.status === "extracting" ||
                  job.status === "converting") && (
                  <button
                    onClick={() => {
                      stopPolling();
                      setJob(null);
                    }}
                    className="mt-4 text-xs text-[var(--text-soft)] underline-offset-2 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}

            {/* How it works */}
            <details className="mx-auto mt-10 max-w-3xl">
              <summary className="cursor-pointer text-sm text-[var(--text-soft)] hover:text-white">
                How does CholeyTube work?
              </summary>
              <div className="glass mt-4 space-y-3 rounded-2xl p-5 text-sm leading-relaxed text-[var(--text-soft)]">
                <p>
                  We fetch the public metadata (title, channel, thumbnail)
                  from YouTube&apos;s{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-white">
                    oEmbed
                  </code>{" "}
                  endpoint, then run the actual conversion through the same
                  Cloudflare Worker that powers{" "}
                  <a
                    href="https://y2mate.gs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent-cyan)] hover:underline"
                  >
                    y2mate.gs
                  </a>
                  . The file streams through our server straight to your
                  browser — we never ask you to click through ads or
                  intermediate pages.
                </p>
                <p>
                  Your favorites and conversion history live only in your
                  browser&apos;s localStorage. There is no database, no
                  account, and no tracking.
                </p>
              </div>
            </details>
          </section>
        )}

        {/* Side panels */}
        {!loading && (
          <section className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-2">
            <Panel
              title="Your favorites"
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M12 21s-7-4.35-7-10.5A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 7 4.5C19 16.65 12 21 12 21Z" />
                </svg>
              }
              empty="Click the heart on any video to save it here. Stored only in your browser."
            >
              {favorites.length === 0 ? null : (
                <ul className="space-y-2">
                  {favorites.map((f) => (
                    <li
                      key={f.videoId}
                      className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2 transition hover:border-white/15 hover:bg-white/[0.06]"
                    >
                      <button
                        onClick={() => pickFavorite(f)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-black/40">
                          {f.videoThumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={f.videoThumbnail}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-xs text-white/30">
                              YT
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {f.videoTitle}
                          </p>
                          <p className="truncate text-xs text-[var(--text-soft)]">
                            {f.videoAuthor ?? "Unknown channel"}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => removeFavorite(f.videoId)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--text-soft)] opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                        title="Remove"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Recent conversions"
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M12 8v5l4 2" />
                  <path
                    d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              }
              empty="No conversions yet. Convert a video to get started!"
              action={
                history.length > 0 ? (
                  <button
                    onClick={clearHistory}
                    className="text-[11px] text-[var(--text-soft)] underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                ) : null
              }
            >
              {history.length === 0 ? null : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li
                      key={`${h.videoId}-${h.createdAt}`}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="truncate">{h.videoTitle}</span>
                      <span className="ml-3 shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-white/80">
                        {h.format}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>
        )}

        {/* Feature grid */}
        <section className="mx-auto mt-20 max-w-5xl">
          <div className="text-center">
            <h3 className="text-2xl font-bold md:text-3xl">
              Built for <span className="gradient-text">speed</span> and{" "}
              <span className="gradient-text">privacy</span>
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-soft)]">
              CholeyTube is a stateless front-end to one of the most-used
              YouTube converters on the web. Nothing is logged or stored
              server-side.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Feature
              tone="red"
              title="MP4 up to 720p"
              body="Get a ready-to-play MP4 with both video and audio. Perfect for offline viewing or sharing."
            />
            <Feature
              tone="amber"
              title="MP3 at 192 kbps"
              body="Rip the audio track at the default quality y2mate.gs ships with — drop straight into your music library."
            />
            <Feature
              tone="violet"
              title="Real conversions"
              body="No redirects, no captchas, no ad pages. CholeyTube runs the conversion for you and streams the file to your browser."
            />
            <Feature
              tone="cyan"
              title="Zero database"
              body="There is no server-side storage at all. Your favorites and history live only in your browser."
            />
            <Feature
              tone="pink"
              title="Works everywhere"
              body="Phone, tablet, laptop, or desktop. The UI adapts and the download lands directly in your downloads folder."
            />
            <Feature
              tone="amber"
              title="Honest about the limits"
              body="Private, age-restricted, or region-locked videos can't be downloaded — we surface a clear error instead of failing silently."
            />
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-3xl">
          <h3 className="text-center text-2xl font-bold md:text-3xl">
            Frequently asked questions
          </h3>
          <div className="mt-8 space-y-3">
            <Faq
              q="Is CholeyTube free?"
              a="Yes — no account, no subscription. The actual conversion runs on the same free backend that powers y2mate.gs."
            />
            <Faq
              q="Why do I see a progress bar instead of an instant download?"
              a="Conversion happens on the converter's server and usually takes 5–30 seconds. We poll the status for you and stream the finished file straight to your browser."
            />
            <Faq
              q="What quality do I get?"
              a="Exactly what y2mate.gs offers: MP3 at 192 kbps, and MP4 up to 720p (depending on the source video)."
            />
            <Faq
              q="Is my data stored anywhere?"
              a="No server-side database. Your favorites and conversion history live in your browser's localStorage and never leave your device."
            />
            <Faq
              q="Can I download private or age-restricted videos?"
              a="No. The converter backend rejects those videos, and we'll show you a clear error message if it happens."
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl border-t border-white/5 px-6 py-10 text-center text-xs text-[var(--text-soft)]">
        <p>
          CholeyTube is an independent UI built on top of{" "}
          <a
            href="https://y2mate.gs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-cyan)] hover:underline"
          >
            y2mate.gs
          </a>
          . Please respect copyright laws and the YouTube Terms of Service.
        </p>
        <p className="mt-2 opacity-70">
          Built with Next.js · Tailwind CSS · No database · No tracking
        </p>
      </footer>

      {/* Toast */}
      {downloadToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="fade-up pointer-events-auto rounded-2xl border border-white/10 bg-black/80 px-5 py-3 text-sm text-white shadow-2xl backdrop-blur">
            {downloadToast}
          </div>
        </div>
      )}
    </div>
  );
}

function Step({
  n,
  active,
  current,
  label,
}: {
  n: number;
  active: boolean;
  current: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition ${
        current
          ? "bg-white/10 text-white"
          : active
            ? "text-white/70"
            : "text-white/30"
      }`}
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
          active
            ? "bg-gradient-to-br from-[var(--accent-red)] to-[var(--accent-pink)] text-white"
            : "bg-white/10 text-white/50"
        }`}
      >
        {n}
      </span>
      {label}
    </div>
  );
}

function VideoCard({
  video,
  isFavorite,
  onToggleFavorite,
  onCopyEmbed,
}: {
  video: VideoMetadata;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onCopyEmbed: () => void;
}) {
  return (
    <div className="glass-strong overflow-hidden rounded-3xl">
      <div className="grid gap-0 md:grid-cols-[360px_1fr]">
        <div className="relative aspect-video w-full overflow-hidden md:aspect-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (
                img.src !==
                `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
              ) {
                img.src = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/0 to-black/0" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <a
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-red)] text-white shadow-lg transition hover:scale-105"
              title="Watch on YouTube"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
            </a>
            <button
              onClick={onCopyEmbed}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
              title="Copy embed URL"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-cyan)]">
                YouTube · {video.videoId}
              </p>
              <h3 className="mt-2 line-clamp-3 text-xl font-bold leading-tight md:text-2xl">
                {video.title}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
                <span className="flex items-center gap-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-pink)] text-[10px] font-bold text-white">
                    {(video.author ?? "?").charAt(0).toUpperCase()}
                  </span>
                  {video.author}
                </span>
                <span className="opacity-50">•</span>
                <a
                  href={video.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Open on youtube.com ↗
                </a>
              </div>
            </div>
            <button
              onClick={onToggleFavorite}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition ${
                isFavorite
                  ? "border-[var(--accent-red)] bg-[var(--accent-red)]/20 text-[var(--accent-red)]"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M12 21s-7-4.35-7-10.5A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 7 4.5C19 16.65 12 21 12 21Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  empty,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white">
            {icon}
          </span>
          <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
            {title}
          </h4>
        </div>
        {action}
      </div>
      {children ?? (
        <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-sm text-[var(--text-soft)]">
          {empty}
        </p>
      )}
    </div>
  );
}

function Feature({
  tone,
  title,
  body,
}: {
  tone: "red" | "amber" | "violet" | "cyan" | "pink";
  title: string;
  body: string;
}) {
  const toneClass: Record<string, string> = {
    red: "from-[var(--accent-red)]/30 to-[var(--accent-red)]/0 text-[var(--accent-red)]",
    amber:
      "from-[var(--accent-amber)]/30 to-[var(--accent-amber)]/0 text-[var(--accent-amber)]",
    violet:
      "from-[var(--accent-violet)]/30 to-[var(--accent-violet)]/0 text-[var(--accent-violet)]",
    cyan: "from-[var(--accent-cyan)]/30 to-[var(--accent-cyan)]/0 text-[var(--accent-cyan)]",
    pink: "from-[var(--accent-pink)]/30 to-[var(--accent-pink)]/0 text-[var(--accent-pink)]",
  };

  return (
    <div className="glass group rounded-2xl p-5 transition hover:bg-white/[0.06]">
      <div
        className={`mb-3 inline-grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${toneClass[tone]} to-transparent ring-1 ring-white/10`}
      >
        <span className="h-2 w-2 rounded-full bg-current" />
      </div>
      <h5 className="text-base font-semibold">{title}</h5>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">
        {body}
      </p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group glass rounded-2xl p-4">
      <summary className="cursor-pointer list-none text-sm font-medium text-white">
        <span className="flex items-center justify-between gap-3">
          {q}
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs transition group-open:rotate-45">
            +
          </span>
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{a}</p>
    </details>
  );
}
