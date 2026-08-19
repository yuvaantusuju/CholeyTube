"use client";

import { Check, Copy, Download, FileAudio2, FileVideo2, Info, Lock, Merge } from "lucide-react";
import { useState } from "react";

import type { MediaFormat, MediaKind } from "@/lib/types";
import { formatBytes } from "@/lib/youtube";

interface Props {
  formats: MediaFormat[];
  title: string;
}

export default function DownloadTable({ formats, title }: Props) {
  const [tab, setTab] = useState<MediaKind>("video");
  const rows = formats.filter((format) => format.kind === tab);
  const counts = {
    video: formats.filter((f) => f.kind === "video").length,
    audio: formats.filter((f) => f.kind === "audio").length,
  };

  return (
    <div className="border-t border-white/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Download format"
          className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1"
        >
          <TabButton
            active={tab === "video"}
            onClick={() => setTab("video")}
            icon={<FileVideo2 className="h-4 w-4" />}
            label="Video · MP4"
            count={counts.video}
          />
          <TabButton
            active={tab === "audio"}
            onClick={() => setTab("audio")}
            icon={<FileAudio2 className="h-4 w-4" />}
            label="Audio · MP3"
            count={counts.audio}
          />
        </div>

        <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <Info className="h-3.5 w-3.5" />
          Sizes marked ~ are estimated from bitrate × duration
        </p>
      </div>

      {/* Header row (desktop only) */}
      <div className="mt-4 hidden grid-cols-[1.1fr_1fr_0.9fr_auto] gap-4 border-b border-white/5 px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:grid">
        <span>Quality</span>
        <span>Format</span>
        <span>Size</span>
        <span className="text-right">Action</span>
      </div>

      <ul role="tabpanel" className="mt-2 space-y-2">
        {rows.map((format, index) => (
          <li
            key={format.id}
            className="animate-fade-up"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <FormatRow format={format} title={title} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
        active
          ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-600/25"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
      <span
        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
          active ? "bg-black/25 text-white/90" : "bg-white/5 text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function FormatRow({ format, title }: { format: MediaFormat; title: string }) {
  const [copied, setCopied] = useState(false);

  const fileName = `${slugify(title)}-${format.label}.${format.container}`;

  async function copyLink() {
    if (!format.url) return;
    try {
      await navigator.clipboard.writeText(format.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable – silently ignore */
    }
  }

  return (
    <div
      className={`grid grid-cols-2 items-center gap-3 rounded-xl border px-4 py-3 transition sm:grid-cols-[1.1fr_1fr_0.9fr_auto] sm:gap-4 ${
        format.available
          ? "border-white/10 bg-white/[0.03] hover:border-brand-400/30 hover:bg-white/[0.06]"
          : "border-white/[0.06] bg-white/[0.015]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
            format.kind === "video"
              ? "bg-brand-500/15 text-brand-300"
              : "bg-accent-500/15 text-accent-400"
          }`}
        >
          {format.kind === "video" ? "MP4" : "MP3"}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
            {format.label}
            {format.muxed && (
              <span
                title="Video and audio are separate on YouTube at this resolution — CholeyTube merges them on the fly with ffmpeg (no re-encoding)."
                className="inline-flex items-center gap-1 rounded-md border border-accent-400/30 bg-accent-500/10 px-1.5 py-0.5 text-[9px] font-medium text-accent-400"
              >
                <Merge className="h-2.5 w-2.5" />
                merged
              </span>
            )}
          </p>
          <p className="truncate text-[11px] text-slate-500 sm:hidden">{format.description}</p>
        </div>
      </div>

      <p className="hidden truncate text-sm text-slate-400 sm:block">{format.description}</p>

      <p className="text-right text-sm text-slate-300 sm:text-left">
        {format.approxSizeBytes ? (
          <>
            {format.estimated && <span className="text-slate-500">~</span>}
            {formatBytes(format.approxSizeBytes)}
          </>
        ) : (
          <span className="text-slate-600">unknown</span>
        )}
      </p>

      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
        {format.available && format.proxyUrl ? (
          <>
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy direct link"
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            {/* Routed through /api/download/stream: cross-origin links ignore
                the `download` attribute, so the proxy sets Content-Disposition. */}
            <a
              href={format.proxyUrl}
              download={fileName}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-brand-600/20 transition hover:from-brand-400 hover:to-brand-500"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </>
        ) : (
          <span
            title={format.note ?? "Unavailable"}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-500"
          >
            <Lock className="h-3.5 w-3.5" />
            {format.note ?? "Unavailable"}
          </span>
        )}
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "choleytube"
  );
}
