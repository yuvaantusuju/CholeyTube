"use client";

import axios from "axios";
import { History, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import ErrorBanner from "./ErrorBanner";
import ResultPanel from "./ResultPanel";
import ResultSkeleton from "./ResultSkeleton";
import UrlInputBar from "./UrlInputBar";
import type { ApiFailure, ApiResponse, VideoResult } from "@/lib/types";
import { parseYouTubeUrl } from "@/lib/youtube";

type Status = "idle" | "loading" | "success" | "error";

interface RecentItem {
  videoId: string;
  title: string;
  thumbnail: string;
  watchUrl: string;
}

const STORAGE_KEY = "choleytube:recent";

export default function Downloader() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<VideoResult | null>(null);
  const [error, setError] = useState<ApiFailure["error"] | null>(null);
  const [step, setStep] = useState(0);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Restore recent lookups after hydration (avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setRecent(JSON.parse(raw) as RecentItem[]);
    } catch {
      /* corrupt storage – ignore */
    }
  }, []);

  // Drive the skeleton's step indicator while loading.
  useEffect(() => {
    if (status !== "loading") {
      setStep(0);
      return;
    }
    const timers = [
      setTimeout(() => setStep(1), 450),
      setTimeout(() => setStep(2), 1100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [status]);

  const analyse = useCallback(async (rawUrl: string) => {
    const parsed = parseYouTubeUrl(rawUrl);
    if (!parsed.ok) {
      setStatus("error");
      setResult(null);
      setError({
        code: parsed.code,
        message: parsed.message,
        hint:
          parsed.code === "EMPTY_INPUT"
            ? "Tap Paste, or drop in any youtube.com / youtu.be link."
            : "Supported: watch?v=…, youtu.be/…, /shorts/…, /embed/…",
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const response = await axios.post<ApiResponse>(
        "/api/download",
        { url: parsed.watchUrl },
        {
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          validateStatus: () => true,
          timeout: 20_000,
        },
      );

      const payload = response.data;

      if (!payload || typeof payload !== "object" || !("ok" in payload)) {
        throw new Error("Malformed response from /api/download");
      }

      if (!payload.ok) {
        setStatus("error");
        setError(payload.error);
        return;
      }

      setResult(payload.data);
      setStatus("success");
      pushRecent(payload.data, setRecent);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      if (axios.isCancel(err)) return;
      setStatus("error");
      setError({
        code: axios.isAxiosError(err) && err.code === "ECONNABORTED" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
        message:
          axios.isAxiosError(err) && err.code === "ECONNABORTED"
            ? "The analysis took too long and was cancelled."
            : "Could not reach the CholeyTube API. Check your connection and retry.",
        hint: "The request is proxied server-side, so YouTube never sees your IP.",
      });
    }
  }, []);

  function clearRecent() {
    setRecent([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w-full">
      <UrlInputBar
        value={url}
        loading={status === "loading"}
        onChange={setUrl}
        onSubmit={() => void analyse(url)}
        onClear={() => {
          setUrl("");
          setError(null);
          if (status === "error") setStatus(result ? "success" : "idle");
        }}
      />

      <div ref={resultRef} className="mt-8 scroll-mt-24 space-y-6">
        {status === "loading" && <ResultSkeleton step={step} />}

        {status === "error" && error && (
          <ErrorBanner
            code={error.code}
            message={error.message}
            hint={error.hint}
            onRetry={error.code === "EMPTY_INPUT" ? undefined : () => void analyse(url)}
            onDismiss={() => {
              setError(null);
              setStatus(result ? "success" : "idle");
            }}
          />
        )}

        {status === "success" && result && <ResultPanel result={result} />}

        {status === "idle" && recent.length === 0 && (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
            <Sparkles className="h-4 w-4 text-brand-400/70" />
            Results appear here — thumbnail, duration, channel and every MP4 / MP3 quality.
          </p>
        )}

        {recent.length > 0 && status !== "loading" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <History className="h-3.5 w-3.5" />
                Recent lookups
              </p>
              <button
                type="button"
                onClick={clearRecent}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 transition hover:text-rose-300"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {recent.map((item) => (
                <button
                  key={item.videoId}
                  type="button"
                  onClick={() => {
                    setUrl(item.watchUrl);
                    void analyse(item.watchUrl);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-2 text-left transition hover:border-brand-400/30 hover:bg-white/[0.04]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-10 w-16 shrink-0 rounded-lg object-cover"
                  />
                  <span className="line-clamp-2 text-xs text-slate-300">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function pushRecent(data: VideoResult, setRecent: (items: RecentItem[]) => void) {
  const entry: RecentItem = {
    videoId: data.videoId,
    title: data.title,
    thumbnail: data.thumbnail,
    watchUrl: data.watchUrl,
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    const next = [entry, ...current.filter((item) => item.videoId !== entry.videoId)].slice(0, 4);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setRecent(next);
  } catch {
    setRecent([entry]);
  }
}
