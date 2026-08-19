"use client";

import { CheckCircle2, Download, FlaskConical } from "lucide-react";

import type { SampleDownload } from "@/lib/types";

/**
 * Shown in preview mode. These files are openly licensed, so they can be
 * served for real — which proves the streaming/download path works before any
 * extraction backend is attached.
 */
export default function SampleDownloads({ samples }: { samples: SampleDownload[] }) {
  if (samples.length === 0) return null;

  const credit = samples[0].credit;

  return (
    <div className="mx-5 mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 sm:mx-6 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          These actually download
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <FlaskConical className="h-3.5 w-3.5" />
          pipeline test
        </span>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
        The rows above are inert because no extraction backend is attached. To prove the download
        path itself works, here are real, openly-licensed files served through the same
        <code className="mx-1 rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">
          /api/download/stream
        </code>
        proxy. Click one and your browser will save an actual file.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {samples.map((sample) => (
          <a
            key={sample.id}
            href={sample.proxyUrl}
            download
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/40 hover:bg-emerald-400/20 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            {sample.label}
            <span className="font-normal text-emerald-300/70">
              {sample.container.toUpperCase()}
            </span>
          </a>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        “{credit.title}” © {credit.author} —{" "}
        <a
          href={credit.licenceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-dotted transition hover:text-slate-300"
        >
          {credit.licence}
        </a>
        . Source:{" "}
        <a
          href={credit.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-dotted transition hover:text-slate-300"
        >
          {credit.sourceUrl.replace(/^https?:\/\//, "")}
        </a>
      </p>
    </div>
  );
}
