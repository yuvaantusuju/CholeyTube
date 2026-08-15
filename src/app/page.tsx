"use client";

import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Disc3,
  Download,
  Film,
  Gauge,
  Headphones,
  Image as ImageIcon,
  Info,
  Link2,
  Loader2,
  MonitorPlay,
  Music2,
  Radio,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MP3_QUALITIES, MP4_QUALITIES, type DownloadMode, type VideoInfo } from "@/lib/types";

type ToastType = "success" | "error" | "info";
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

type Status = "idle" | "fetching" | "ready" | "converting";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [mode, setMode] = useState<DownloadMode>("mp3");
  const [mp3Quality, setMp3Quality] = useState<string>("192");
  const [mp4Quality, setMp4Quality] = useState<string>("720");
  const [embedThumbnail, setEmbedThumbnail] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const busy = status === "fetching" || status === "converting";

  const pushToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4600);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const resolveUrl = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      pushToast("error", "Please paste a YouTube link first.");
      return;
    }
    setStatus("fetching");
    setStatusMessage("Fetching metadata…");
    setInfo(null);
    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok || !data.info) {
        pushToast("error", data.error || "Could not resolve this link.");
        setStatus("idle");
        setStatusMessage(null);
        return;
      }
      setInfo(data.info as VideoInfo);
      setStatus("ready");
      setStatusMessage(null);
      pushToast("success", "Link resolved — pick your format below.");
    } catch {
      pushToast("error", "Network error — please try again.");
      setStatus("idle");
      setStatusMessage(null);
    }
  }, [url, pushToast]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        pushToast("info", "Your clipboard is empty.");
        return;
      }
      setUrl(text.trim());
      pushToast("info", "Link detected from clipboard.");
    } catch {
      pushToast("error", "Clipboard access denied — paste manually instead.");
    }
  }, [pushToast]);

  const startDownload = useCallback(() => {
    if (!info) return;
    const params = new URLSearchParams({
      url: info.webpageUrl || url.trim(),
      type: mode,
      quality: mode === "mp3" ? mp3Quality : mp4Quality,
      embedThumbnail: mode === "mp3" && embedThumbnail ? "1" : "0",
    });
    const href = `/api/download?${params.toString()}`;

    setStatus("converting");
    setStatusMessage(
      mode === "mp3" ? "Converting to MP3…" : "Preparing video download…",
    );

    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    pushToast(
      "success",
      `${mode === "mp3" ? "MP3" : "MP4"} download started — check your browser's downloads.`,
    );

    window.setTimeout(() => {
      setStatus("ready");
      setStatusMessage(null);
    }, 2600);
  }, [info, url, mode, mp3Quality, mp4Quality, embedThumbnail, pushToast]);

  const downloadLabel = useMemo(() => {
    if (mode === "mp3") {
      const q = MP3_QUALITIES.find((item) => item.value === mp3Quality);
      return `Download MP3 · ${q?.label ?? "192 kbps"}`;
    }
    const r = MP4_QUALITIES.find((item) => item.value === mp4Quality);
    return `Download MP4 · ${r?.label ?? "720p"}`;
  }, [mode, mp3Quality, mp4Quality]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Background />

      <Header />

      <div className="fixed bottom-5 right-5 z-50 flex w-[min(92vw,380px)] flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        {/* Hero */}
        <section className="mx-auto mt-12 max-w-3xl text-center sm:mt-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
            Fast · Free · Private — powered by yt-dlp
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl"
          >
            Download YouTube.
            <br />
            <span className="text-gradient">Convert to MP3.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg"
          >
            Paste any YouTube video, Short, or playlist link to grab crisp MP3
            audio (up to 320 kbps) or full MP4 video up to 4K.
          </motion.p>
        </section>

        {/* Downloader card */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="mx-auto mt-10 max-w-2xl"
        >
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_80px_-20px_rgba(139,92,246,0.35)] backdrop-blur-xl sm:p-6">
            {/* Input */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void resolveUrl();
                  }}
                  placeholder="Paste YouTube link (video, Short, or playlist)…"
                  aria-label="YouTube link"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-fuchsia-500/60 focus:ring-4 focus:ring-fuchsia-500/10"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handlePaste()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 sm:flex-none"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => void resolveUrl()}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
                >
                  {status === "fetching" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Resolve
                </button>
              </div>
            </div>

            {/* Status line */}
            <div className="mt-3 flex min-h-6 items-center justify-center gap-2 text-sm">
              {status === "fetching" && (
                <span className="inline-flex items-center gap-2 text-fuchsia-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {statusMessage ?? "Fetching metadata…"}
                </span>
              )}
              {status === "converting" && (
                <span className="inline-flex items-center gap-2 text-rose-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {statusMessage ?? "Converting…"}
                </span>
              )}
              {status === "idle" && (
                <span className="inline-flex items-center gap-2 text-zinc-500">
                  <Radio className="h-3.5 w-3.5" />
                  Supports videos, Shorts &amp; playlists
                </span>
              )}
            </div>

            {/* Preview */}
            <AnimatePresence>
              {info && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <PreviewCard info={info} />

                  {/* Mode tabs */}
                  <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
                    <TabButton
                      active={mode === "mp3"}
                      onClick={() => setMode("mp3")}
                      icon={<Music2 className="h-4 w-4" />}
                      label="Audio · MP3"
                      layoutId="mode-tab"
                    />
                    <TabButton
                      active={mode === "mp4"}
                      onClick={() => setMode("mp4")}
                      icon={<Film className="h-4 w-4" />}
                      label="Video · MP4"
                      layoutId="mode-tab"
                    />
                  </div>

                  {/* Quality options */}
                  <div className="mt-5">
                    <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {mode === "mp3" ? (
                        <Headphones className="h-3.5 w-3.5" />
                      ) : (
                        <MonitorPlay className="h-3.5 w-3.5" />
                      )}
                      {mode === "mp3" ? "Audio quality" : "Video resolution"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(mode === "mp3" ? MP3_QUALITIES : MP4_QUALITIES).map((q) => {
                        const active =
                          mode === "mp3"
                            ? mp3Quality === q.value
                            : mp4Quality === q.value;
                        return (
                          <button
                            key={q.value}
                            type="button"
                            onClick={() =>
                              mode === "mp3"
                                ? setMp3Quality(q.value)
                                : setMp4Quality(q.value)
                            }
                            className={cn(
                              "rounded-xl border px-3.5 py-2 text-sm transition",
                              active
                                ? "border-fuchsia-500/70 bg-fuchsia-500/15 text-white"
                                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
                            )}
                          >
                            <span className="font-semibold">{q.label}</span>
                            <span className="ml-1.5 text-xs text-zinc-500">
                              {q.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cover art toggle (MP3 only) */}
                  {mode === "mp3" && (
                    <button
                      type="button"
                      onClick={() => setEmbedThumbnail((v) => !v)}
                      className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-300">
                          <ImageIcon className="h-4.5 w-4.5" />
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-white">
                            Embed cover art
                          </span>
                          <span className="block text-xs text-zinc-500">
                            Save the video thumbnail into the MP3&apos;s ID3 tags
                          </span>
                        </span>
                      </span>
                      <Toggle checked={embedThumbnail} />
                    </button>
                  )}

                  {/* Download button */}
                  <motion.button
                    type="button"
                    onClick={startDownload}
                    disabled={busy}
                    whileTap={{ scale: 0.985 }}
                    className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-rose-500 px-6 py-4 text-base font-semibold text-white shadow-xl shadow-fuchsia-600/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {status === "converting" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Download className="h-5 w-5" />
                    )}
                    {status === "converting"
                      ? statusMessage ?? "Converting…"
                      : downloadLabel}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* Features */}
        <section className="mx-auto mt-24 grid max-w-5xl gap-5 sm:grid-cols-3">
          <FeatureCard
            icon={<Disc3 className="h-5 w-5" />}
            title="Studio-grade MP3"
            text="Extract audio at 128, 192, or 320 kbps with embedded cover art and ID3 tags."
          />
          <FeatureCard
            icon={<MonitorPlay className="h-5 w-5" />}
            title="Up to 4K MP4"
            text="Grab crisp video from 360p all the way to 2160p, merged into a single MP4."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Private by design"
            text="No accounts, no tracking, no watermarks. Your links never leave the pipeline."
          />
        </section>

        {/* How it works */}
        <section className="mx-auto mt-24 max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
            Three steps to your file
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <StepCard
              step="01"
              icon={<Link2 className="h-5 w-5" />}
              title="Paste a link"
              text="Drop in any YouTube video, Short, or playlist URL."
            />
            <StepCard
              step="02"
              icon={<Wand2 className="h-5 w-5" />}
              title="Choose format"
              text="Switch between MP3 audio and MP4 video, then pick a quality."
            />
            <StepCard
              step="03"
              icon={<Rocket className="h-5 w-5" />}
              title="Download"
              text="Hit download and save your file in seconds."
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ---------------------------------- sub-components ---------------------------------- */

function Background() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute inset-0 bg-grid" />
      <div className="animate-drift absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-fuchsia-600/25 blur-[120px]" />
      <div className="animate-drift-slow absolute top-40 -left-24 h-80 w-80 rounded-full bg-purple-600/20 blur-[110px]" />
      <div className="animate-drift absolute right-0 top-1/3 h-80 w-80 rounded-full bg-rose-600/20 blur-[110px]" />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#07070d]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 shadow-lg shadow-fuchsia-600/30">
            <Music2 className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            Choley<span className="text-gradient">Tube</span>
          </span>
        </a>
        <div className="hidden items-center gap-2 text-sm text-zinc-400 sm:flex">
          <a href="#features" className="rounded-lg px-3 py-1.5 transition hover:text-white">
            Features
          </a>
          <a href="#how" className="rounded-lg px-3 py-1.5 transition hover:text-white">
            How it works
          </a>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          Free &amp; unlimited
        </span>
      </div>
    </header>
  );
}

function PreviewCard({ info }: { info: VideoInfo }) {
  const [imgSrc, setImgSrc] = useState(
    info.thumbnail ?? `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
  );

  return (
    <div className="mt-5 flex gap-4 rounded-2xl border border-white/10 bg-black/25 p-3.5">
      <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-zinc-900 sm:h-28 sm:w-44">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={info.title}
          className="h-full w-full object-cover"
          onError={() => {
            const fallback = `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`;
            if (imgSrc !== fallback) setImgSrc(fallback);
          }}
        />
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {info.durationLabel}
        </span>
        {info.isShort && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Short
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white sm:text-base">
          {info.title}
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-500 text-[10px] font-bold text-white">
            {info.channel.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{info.channel}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          {info.isPlaylist ? (
            <span className="inline-flex items-center gap-1 text-fuchsia-300">
              <Radio className="h-3.5 w-3.5" />
              Playlist · {info.playlistCount ?? ""} videos
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-400" />
                {info.viewCount ? formatViews(info.viewCount) : "—"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5" />
                {info.isLive ? "Live stream" : "On demand"}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  layoutId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  layoutId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        active ? "text-white" : "text-zinc-400 hover:text-zinc-200",
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-fuchsia-600/80 to-rose-500/80"
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        {label}
      </span>
    </button>
  );
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
        checked ? "bg-fuchsia-600" : "bg-zinc-700",
      )}
    >
      <span
        className={cn(
          "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-1",
        )}
      />
    </span>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div
      id="features"
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-fuchsia-500/30 hover:bg-white/[0.05]"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/25 to-rose-500/25 text-fuchsia-300">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{text}</p>
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  text,
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div id="how" className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <span className="absolute right-5 top-4 text-3xl font-black text-white/5">{step}</span>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-fuchsia-300">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{text}</p>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const config = {
    success: { icon: CheckCircle2, ring: "text-emerald-400" },
    error: { icon: TriangleAlert, ring: "text-rose-400" },
    info: { icon: Info, ring: "text-fuchsia-300" },
  }[toast.type];

  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#12121c]/95 px-4 py-3.5 shadow-2xl shadow-black/50 backdrop-blur"
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", config.ring)} />
      <p className="flex-1 text-sm leading-snug text-zinc-200">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="rounded-md p-1 text-zinc-500 transition hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-zinc-500 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-rose-500">
            <Music2 className="h-4 w-4 text-white" />
          </span>
          <span className="font-semibold text-zinc-300">CholeyTube</span>
        </div>
        <p>Built with Next.js, yt-dlp &amp; FFmpeg. For personal use only.</p>
        <div className="flex items-center gap-4">
          <RefreshCw className="h-4 w-4" />
          <span>Respect creators&apos; rights — download only what you&apos;re allowed to.</span>
        </div>
      </div>
    </footer>
  );
}

function formatViews(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B views`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}
