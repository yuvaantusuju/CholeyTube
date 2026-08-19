"use client";

import { AlertTriangle, RotateCcw, X } from "lucide-react";

import type { ApiErrorCode } from "@/lib/types";

interface Props {
  code: ApiErrorCode;
  message: string;
  hint?: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

const TITLES: Record<ApiErrorCode, string> = {
  EMPTY_INPUT: "Nothing to analyse",
  INVALID_URL: "That link looks off",
  NOT_YOUTUBE: "Unsupported link",
  VIDEO_UNAVAILABLE: "Video unavailable",
  UPSTREAM_ERROR: "Upstream hiccup",
  UPSTREAM_TIMEOUT: "Upstream timed out",
  RATE_LIMITED: "Slow down a touch",
  BAD_REQUEST: "Malformed request",
  INTERNAL_ERROR: "Unexpected error",
};

export default function ErrorBanner({ code, message, hint, onRetry, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="animate-fade-up glass flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] p-4 sm:p-5"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
        <AlertTriangle className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-rose-200">{TITLES[code] ?? "Error"}</p>
        <p className="mt-0.5 text-sm text-slate-300">{message}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
