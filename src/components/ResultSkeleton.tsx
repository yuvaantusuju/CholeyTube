"use client";

import { Loader2 } from "lucide-react";

const STEPS = ["Validating link", "Fetching metadata", "Building quality ladder"];

export default function ResultSkeleton({ step = 0 }: { step?: number }) {
  return (
    <div className="animate-fade-up glass overflow-hidden rounded-3xl border border-white/10">
      <div className="flex items-center gap-3 border-b border-white/5 bg-white/[0.02] px-5 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
        <p className="text-sm font-medium text-slate-300">Analysing your link…</p>
        <div className="ml-auto hidden items-center gap-3 sm:flex">
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={`flex items-center gap-1.5 text-[11px] transition ${
                index <= step ? "text-brand-300" : "text-slate-600"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  index <= step ? "bg-brand-400" : "bg-slate-700"
                }`}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,260px)_1fr]">
        <div className="skeleton aspect-video w-full rounded-2xl" />
        <div className="space-y-3 py-1">
          <div className="skeleton h-5 w-4/5 rounded-lg" />
          <div className="skeleton h-5 w-3/5 rounded-lg" />
          <div className="flex gap-2 pt-2">
            <div className="skeleton h-6 w-24 rounded-full" />
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-6 w-28 rounded-full" />
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-white/5 p-5">
        <div className="skeleton h-9 w-56 rounded-xl" />
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="skeleton h-14 w-full rounded-xl"
            style={{ animationDelay: `${row * 120}ms`, opacity: 1 - row * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
