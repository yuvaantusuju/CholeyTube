"use client";

import { CheckCircle2, Clock3, ExternalLink, PlayCircle, Radio, User2, Zap } from "lucide-react";
import { useState } from "react";

import type { VideoResult } from "@/lib/types";
import { thumbnailFor } from "@/lib/youtube";

export default function VideoCard({ result }: { result: VideoResult }) {
  const [src, setSrc] = useState(result.thumbnail || thumbnailFor(result.videoId));

  return (
    <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,280px)_1fr] sm:p-6">
      <a
        href={result.watchUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="group relative block aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-800"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          onError={() => setSrc(thumbnailFor(result.videoId))}
          alt={result.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-80" />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <PlayCircle className="h-12 w-12 text-white/90 drop-shadow-lg" />
        </span>
        {result.durationLabel !== "--:--" && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white">
            {result.durationLabel}
          </span>
        )}
      </a>

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={result.mode === "live" ? "emerald" : "amber"}
            icon={result.mode === "live" ? <CheckCircle2 className="h-3 w-3" /> : <Radio className="h-3 w-3" />}
          >
            {result.mode === "live" ? "Live links" : "Preview mode"}
          </Badge>
          <Badge tone="slate" icon={<Zap className="h-3 w-3" />}>
            {result.cached ? "cached" : `${result.elapsedMs} ms`}
          </Badge>
          <Badge tone={result.degraded ? "amber" : "slate"}>
            {result.degraded ? `${result.metadataSource} · partial` : result.metadataSource}
          </Badge>
        </div>

        <h2 className="mt-3 line-clamp-3 text-lg font-semibold leading-snug text-white sm:text-xl">
          {result.title}
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <User2 className="h-4 w-4 text-slate-500" />
            {result.channelUrl ? (
              <a
                href={result.channelUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="transition hover:text-brand-300"
              >
                {result.channel}
              </a>
            ) : (
              result.channel
            )}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-4 w-4 text-slate-500" />
            {result.durationLabel === "--:--" ? "Duration unknown" : result.durationLabel}
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
          <a
            href={result.watchUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open on YouTube
          </a>
          <code className="rounded-lg border border-white/5 bg-black/30 px-2 py-1 font-mono text-[11px] text-slate-500">
            id: {result.videoId}
          </code>
        </div>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: "emerald" | "amber" | "slate";
  icon?: React.ReactNode;
}) {
  const tones = {
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    slate: "border-white/10 bg-white/5 text-slate-400",
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
