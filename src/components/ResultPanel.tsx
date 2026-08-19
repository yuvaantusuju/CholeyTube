"use client";

import { Server, ShieldAlert } from "lucide-react";

import DownloadTable from "./DownloadTable";
import SampleDownloads from "./SampleDownloads";
import VideoCard from "./VideoCard";
import type { VideoResult } from "@/lib/types";

export default function ResultPanel({ result }: { result: VideoResult }) {
  return (
    <section
      id="result"
      aria-label="Download options"
      className="animate-pop glass overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40"
    >
      <VideoCard result={result} />

      {result.notice && (
        <div className="mx-5 mb-1 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 sm:mx-6">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-xs leading-relaxed text-amber-200/90">
            {result.notice} The extraction step runs as a separate process you control — see{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 font-mono">resolver/server.mjs</code>.
            Use it for media you own, have permission to download, or that is openly licensed.
          </p>
        </div>
      )}

      <SampleDownloads samples={result.samples} />

      <DownloadTable formats={result.formats} title={result.title} />

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 bg-black/20 px-5 py-3 text-[11px] text-slate-500 sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5" />
          resolver: <code className="font-mono text-slate-400">{result.resolverHost}</code>
        </span>
        <span>
          fetched{" "}
          {new Date(result.fetchedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
        <span className="ml-auto">{result.formats.length} formats listed</span>
      </footer>
    </section>
  );
}
