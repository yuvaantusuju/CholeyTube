"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle,
  Search,
  ClipboardPaste,
  Download,
  Music2,
  Video,
  Loader2,
  Check,
  X,
  Clock,
  User,
  Sparkles,
  Trash2,
  Volume2,
  Film,
  ShieldCheck,
  Zap,
  Image as ImageIcon,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import clsx from "clsx";

type Mode = "mp3" | "mp4";
type Status = "idle" | "fetching" | "processing" | "downloading" | "done" | "error";

interface VideoMeta {
  ok: boolean;
  isPlaylist: boolean;
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
  description?: string;
  viewCount?: number;
  url: string;
  entriesCount?: number;
}

const MP3_QUALITIES = [
  { value: "128", label: "128 kbps", sub: "Fast / Standard", badge: "FAST" },
  { value: "192", label: "192 kbps", sub: "Medium", badge: "BALANCED" },
  { value: "320", label: "320 kbps", sub: "High Quality", badge: "BEST" },
];

const MP4_RESOLUTIONS = [
  { value: "360", label: "360p", sub: "SD", badge: "SMALL" },
  { value: "480", label: "480p", sub: "SD+", badge: "STANDARD" },
  { value: "720", label: "720p", sub: "HD", badge: "HD" },
  { value: "1080", label: "1080p", sub: "Full HD", badge: "FHD" },
  { value: "2160", label: "4K", sub: "Ultra HD", badge: "4K" },
];

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("mp3");
  const [quality, setQuality] = useState("192");
  const [resolution, setResolution] = useState("720");
  const [embedThumb, setEmbedThumb] = useState(true);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const reset = useCallback(() => {
    setMeta(null);
    setStatus("idle");
    setStatusMsg("");
  }, []);

  const fetchMetadata = useCallback(
    async (targetUrl: string) => {
      if (!targetUrl.trim()) {
        toast.error("Please paste a YouTube link first.");
        return;
      }
      setStatus("fetching");
      setStatusMsg("Fetching video metadata...");
      setMeta(null);
      try {
        const res = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setStatus("error");
          setStatusMsg("");
          toast.error(data.error || "Couldn't load that video.");
          return;
        }
        if (data.isPlaylist) {
          setStatus("error");
          toast.error("Playlists aren't supported yet. Paste a single video link.");
          setStatusMsg("");
          return;
        }
        setMeta(data as VideoMeta);
        setStatus("idle");
        setStatusMsg("");
        toast.success("Video found! Choose your format and quality.");
      } catch (e) {
        console.error(e);
        setStatus("error");
        setStatusMsg("");
        toast.error("Network error while fetching video info.");
      }
    },
    []
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        toast.success("Pasted from clipboard!");
        // Auto-fetch metadata after paste
        fetchMetadata(text.trim());
      } else {
        toast.error("Clipboard is empty.");
      }
    } catch {
      toast.error("Clipboard access denied. Paste manually (Ctrl/Cmd+V).");
    }
  }, [fetchMetadata]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!url.trim()) {
        toast.error("Please paste a YouTube link first.");
        return;
      }
      if (!meta) {
        await fetchMetadata(url);
        return;
      }
      // Trigger download
      setStatus("processing");
      setStatusMsg(
        mode === "mp3"
          ? "Extracting audio & converting to MP3..."
          : "Preparing MP4 video..."
      );

      try {
        const res = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: meta.url,
            mode,
            quality: mode === "mp3" ? quality : undefined,
            resolution: mode === "mp4" ? resolution : undefined,
            embedThumbnail: embedThumb,
          }),
        });

        if (!res.ok || !res.body) {
          let err = "Download failed.";
          try {
            const data = await res.json();
            err = data.error || err;
          } catch {}
          setStatus("error");
          setStatusMsg("");
          toast.error(err);
          return;
        }

        setStatus("downloading");
        setStatusMsg("Saving file to your device...");

        // Extract filename from content-disposition
        const disposition = res.headers.get("Content-Disposition") || "";
        let filename = `choleytube-${mode}.${mode === "mp3" ? "mp3" : "mp4"}`;
        const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
        if (match && match[1]) {
          try {
            filename = decodeURIComponent(match[1].replace(/^"|"$/g, ""));
          } catch {
            filename = match[1];
          }
        }

        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 3000);

        setStatus("done");
        setStatusMsg("Download complete!");
        toast.success("Download complete — enjoy your file!");
        setTimeout(() => {
          if (status === "done") {
            setStatus("idle");
            setStatusMsg("");
          }
        }, 3500);
      } catch (e) {
        console.error(e);
        setStatus("error");
        setStatusMsg("");
        toast.error("Something went wrong during download.");
      }
    },
    [url, meta, mode, quality, resolution, embedThumb, fetchMetadata, status]
  );

  // When switching mode, reset quality defaults to sensible values
  useEffect(() => {
    if (mode === "mp3") setQuality("192");
    else setResolution("720");
  }, [mode]);

  const isBusy = status === "fetching" || status === "processing" || status === "downloading";

  return (
    <div className="relative min-h-screen flex flex-col">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(20, 8, 40, 0.95)",
            color: "#fff",
            border: "1px solid rgba(192,132,252,0.3)",
            backdropFilter: "blur(10px)",
          },
          iconTheme: { primary: "#c084fc", secondary: "#fff" },
        }}
      />

      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-red-600/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-700/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="px-6 pt-8 pb-4 md:pt-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-red-600 shadow-lg shadow-purple-900/50">
              <PlayCircle className="h-6 w-6 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                <span className="gradient-text">Choley</span>
                <span className="text-white">Tube</span>
              </h1>
              <p className="text-xs md:text-sm text-purple-200/70 -mt-0.5">
                YouTube → MP3 / MP4, fast & clean
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="hidden sm:flex items-center gap-2 text-xs text-purple-200/70"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>No signup · No tracking</span>
          </motion.div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 md:px-6 pb-10">
        <div className="mx-auto max-w-3xl mt-6 md:mt-12">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8 md:mb-10"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              High quality MP3 & MP4 downloads
            </div>
            <h2 className="text-3xl md:text-5xl font-black leading-tight tracking-tight">
              Grab any YouTube video
              <br />
              as <span className="gradient-text">MP3 audio</span> or{" "}
              <span className="gradient-text">MP4 video</span>
            </h2>
            <p className="mt-4 text-purple-200/70 max-w-xl mx-auto text-sm md:text-base">
              Paste a YouTube link, pick your format and quality, and CholeyTube
              handles the rest — powered by yt-dlp + FFmpeg.
            </p>
          </motion.div>

          {/* Input Card */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-strong rounded-2xl p-2 md:p-2.5 shadow-2xl shadow-purple-900/30"
          >
            <div className="flex items-center gap-2">
              <div className="pl-3 text-purple-300/60">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (meta) reset();
                }}
                placeholder="Paste a YouTube link here (video, shorts, music...)"
                className="flex-1 bg-transparent px-2 py-3 text-sm md:text-base text-white placeholder:text-purple-300/40 focus:outline-none"
                disabled={isBusy}
                spellCheck={false}
                autoComplete="off"
              />
              {url && !isBusy && (
                <button
                  type="button"
                  onClick={() => {
                    setUrl("");
                    reset();
                  }}
                  className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg text-purple-300/70 hover:bg-white/5 hover:text-white transition"
                  title="Clear"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handlePaste}
                disabled={isBusy}
                className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-sm font-medium text-purple-100 transition disabled:opacity-50"
              >
                <ClipboardPaste className="h-4 w-4" />
                Paste
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 md:px-5 py-2.5 text-sm md:text-base font-semibold text-white disabled:opacity-60"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">
                      {status === "fetching"
                        ? "Fetching..."
                        : status === "processing"
                        ? "Converting..."
                        : "Downloading..."}
                    </span>
                  </>
                ) : meta ? (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span className="hidden sm:inline">Fetch</span>
                    <span className="sm:hidden">Go</span>
                  </>
                )}
              </button>
            </div>

            {/* Mobile paste button */}
            <div className="md:hidden flex px-2 pb-1 pt-1">
              <button
                type="button"
                onClick={handlePaste}
                disabled={isBusy}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-sm font-medium text-purple-100 transition disabled:opacity-50"
              >
                <ClipboardPaste className="h-4 w-4" />
                Paste from Clipboard
              </button>
            </div>
          </motion.form>

          {/* Status indicator */}
          <AnimatePresence>
            {isBusy && statusMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4 flex items-center justify-center gap-3 rounded-xl glass px-4 py-3"
              >
                <span className="relative flex h-3 w-3">
                  <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-purple-500" />
                </span>
                <span className="text-sm text-purple-100">{statusMsg}</span>
              </motion.div>
            )}
            {status === "done" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3"
              >
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-200">
                  Your file is ready and should begin downloading shortly.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preview Card */}
          <AnimatePresence mode="wait">
            {meta && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="mt-6 glass-strong rounded-2xl overflow-hidden shadow-2xl shadow-purple-900/40"
              >
                <div className="flex flex-col md:flex-row gap-0">
                  {/* Thumbnail */}
                  <div className="relative md:w-72 md:shrink-0 aspect-video md:aspect-auto bg-black/50">
                    {meta.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={meta.thumbnail}
                        alt={meta.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            `https://i.ytimg.com/vi/${meta.id}/hqdefault.jpg`;
                        }}
                      />
                    )}
                    <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(meta.duration)}
                      </span>
                    </div>
                    <button
                      onClick={reset}
                      className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition"
                      title="Use a different link"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex-1 p-4 md:p-5">
                    <h3
                      className="font-bold text-white text-lg leading-snug line-clamp-2"
                      title={meta.title}
                    >
                      {meta.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-purple-200/80 inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {meta.channel}
                    </p>

                    {/* Mode Tabs */}
                    <div className="mt-5">
                      <div className="inline-flex rounded-xl bg-black/30 p-1 border border-white/5">
                        <button
                          type="button"
                          onClick={() => setMode("mp3")}
                          className={clsx(
                            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
                            mode === "mp3"
                              ? "bg-gradient-to-r from-purple-600 to-red-600 text-white shadow-md"
                              : "text-purple-200/70 hover:text-white"
                          )}
                        >
                          <Music2 className="h-4 w-4" />
                          Audio (MP3)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode("mp4")}
                          className={clsx(
                            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
                            mode === "mp4"
                              ? "bg-gradient-to-r from-purple-600 to-red-600 text-white shadow-md"
                              : "text-purple-200/70 hover:text-white"
                          )}
                        >
                          <Video className="h-4 w-4" />
                          Video (MP4)
                        </button>
                      </div>
                    </div>

                    {/* Quality Options */}
                    <AnimatePresence mode="wait">
                      {mode === "mp3" ? (
                        <motion.div
                          key="mp3"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.2 }}
                          className="mt-4"
                        >
                          <p className="text-xs uppercase tracking-wider text-purple-300/70 font-semibold mb-2 flex items-center gap-1.5">
                            <Volume2 className="h-3.5 w-3.5" />
                            Audio Quality
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {MP3_QUALITIES.map((q) => (
                              <button
                                key={q.value}
                                type="button"
                                onClick={() => setQuality(q.value)}
                                className={clsx(
                                  "group rounded-xl border p-2.5 text-left transition",
                                  quality === q.value
                                    ? "border-purple-400/60 bg-purple-500/15 shadow-md shadow-purple-900/40"
                                    : "border-white/10 bg-white/5 hover:border-purple-400/30 hover:bg-white/10"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-white text-sm">
                                    {q.label}
                                  </span>
                                  {quality === q.value && (
                                    <Check className="h-4 w-4 text-purple-300" />
                                  )}
                                </div>
                                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-purple-200/70 font-medium">
                                  {q.sub}
                                </div>
                              </button>
                            ))}
                          </div>

                          <label className="mt-3 flex items-center gap-2 text-xs text-purple-200/80 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={embedThumb}
                              onChange={(e) => setEmbedThumb(e.target.checked)}
                              className="h-4 w-4 rounded border-purple-400/50 bg-white/10 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                            />
                            <ImageIcon className="h-3.5 w-3.5" />
                            Embed thumbnail & metadata into MP3 (ID3 tags)
                          </label>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="mp4"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                          className="mt-4"
                        >
                          <p className="text-xs uppercase tracking-wider text-purple-300/70 font-semibold mb-2 flex items-center gap-1.5">
                            <Film className="h-3.5 w-3.5" />
                            Video Resolution
                          </p>
                          <div className="grid grid-cols-5 gap-2">
                            {MP4_RESOLUTIONS.map((r) => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => setResolution(r.value)}
                                className={clsx(
                                  "group rounded-xl border px-1 py-2 text-center transition",
                                  resolution === r.value
                                    ? "border-purple-400/60 bg-purple-500/15 shadow-md shadow-purple-900/40"
                                    : "border-white/10 bg-white/5 hover:border-purple-400/30 hover:bg-white/10"
                                )}
                              >
                                <div className="flex items-center justify-center">
                                  <span className="font-bold text-white text-sm">
                                    {r.label}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[9px] uppercase tracking-wider text-purple-200/70 font-semibold">
                                  {r.sub}
                                </div>
                              </button>
                            ))}
                          </div>
                          <p className="mt-3 text-[11px] text-purple-200/60">
                            <Zap className="inline h-3 w-3 mr-1 text-amber-300" />
                            Higher resolutions (1080p / 4K) may take longer to
                            process and merge.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Download CTA */}
                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      disabled={isBusy}
                      className="btn-primary mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-bold text-white"
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {statusMsg || "Processing..."}
                        </>
                      ) : (
                        <>
                          <Download className="h-5 w-5" />
                          Download {mode === "mp3" ? "MP3" : "MP4"}
                          {mode === "mp3" ? ` · ${quality} kbps` : ` · ${resolution}p`}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Features */}
          {!meta && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {[
                {
                  icon: Music2,
                  title: "MP3 Audio Extraction",
                  desc: "Direct MP3 conversion at 128 / 192 / 320 kbps with optional ID3 cover art.",
                  color: "from-purple-500 to-fuchsia-500",
                },
                {
                  icon: Video,
                  title: "MP4 Video up to 4K",
                  desc: "Grab videos in resolutions from 360p up to 4K when available.",
                  color: "from-red-500 to-orange-500",
                },
                {
                  icon: Zap,
                  title: "Fast. Private. Free.",
                  desc: "Files processed via yt-dlp + FFmpeg, streamed straight to your device.",
                  color: "from-pink-500 to-purple-500",
                },
              ].map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  className="glass rounded-2xl p-5 hover:border-purple-400/30 transition"
                >
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} shadow-lg`}
                  >
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mt-3 font-bold text-white">{f.title}</h3>
                  <p className="mt-1 text-sm text-purple-200/70 leading-relaxed">
                    {f.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-purple-300/50">
        <p>
          CholeyTube is for personal use only. Please respect YouTube&apos;s Terms
          of Service and creators&apos; rights.
        </p>
        <p className="mt-1">
          Built with Next.js, yt-dlp & FFmpeg ·{" "}
          <span className="gradient-text font-semibold">CholeyTube</span>
        </p>
      </footer>
    </div>
  );
}
