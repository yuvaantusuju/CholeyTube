"use client";

import { ClipboardPaste, Download, Link2, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

/** Every id below was verified to return HTTP 200 from YouTube's oEmbed API. */
const EXAMPLES = [
  { label: "watch?v=", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { label: "youtu.be", url: "https://youtu.be/aqz-KE-bpKQ" },
  { label: "bare id", url: "jNQXAC9IVRw" },
];

export default function UrlInputBar({ value, loading, onChange, onSubmit, onClear }: Props) {
  const [pasteState, setPasteState] = useState<"idle" | "ok" | "denied">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pasteState === "idle") return;
    const t = setTimeout(() => setPasteState("idle"), 2200);
    return () => clearTimeout(t);
  }, [pasteState]);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setPasteState("denied");
        return;
      }
      onChange(text.trim());
      setPasteState("ok");
      inputRef.current?.focus();
    } catch {
      setPasteState("denied");
      inputRef.current?.focus();
    }
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="group relative rounded-2xl bg-gradient-to-r from-brand-500/40 via-accent-500/30 to-brand-500/40 p-px shadow-2xl shadow-brand-600/10 transition focus-within:from-brand-500 focus-within:via-accent-500 focus-within:to-brand-400"
      >
        <div className="glass flex flex-col gap-2 rounded-[15px] bg-ink-900/90 p-2 sm:flex-row sm:items-center">
          <div className="relative flex min-w-0 flex-1 items-center">
            <Link2
              className="pointer-events-none absolute left-3 h-5 w-5 shrink-0 text-slate-500"
              aria-hidden
            />
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              aria-label="YouTube video link"
              placeholder="Paste a YouTube link — youtube.com/watch?v=… or youtu.be/…"
              className="w-full rounded-xl bg-transparent py-3 pl-11 pr-20 text-sm text-slate-100 outline-none placeholder:text-slate-500 sm:text-base"
            />

            <div className="absolute right-2 flex items-center gap-1">
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  aria-label="Clear input"
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handlePaste}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span className="hidden xs:inline sm:inline">Paste</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-400 hover:to-brand-500 hover:shadow-brand-500/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:opacity-70 sm:h-11"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download / Convert
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="text-slate-600">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.url}
            type="button"
            onClick={() => onChange(example.url)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400 transition hover:border-brand-400/40 hover:text-brand-300"
          >
            {example.label}
          </button>
        ))}
        <span
          aria-live="polite"
          className={`ml-auto transition ${pasteState === "idle" ? "opacity-0" : "opacity-100"}`}
        >
          {pasteState === "ok" && <span className="text-emerald-400">Pasted from clipboard</span>}
          {pasteState === "denied" && (
            <span className="text-amber-400">Clipboard blocked — paste manually (Ctrl+V)</span>
          )}
        </span>
      </div>
    </div>
  );
}
