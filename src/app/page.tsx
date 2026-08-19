import { Clapperboard, Music4, ShieldCheck, Zap } from "lucide-react";

import Downloader from "@/components/Downloader";
import Navbar from "@/components/Navbar";
import { Faq, FeatureGrid, Footer, HowItWorks } from "@/components/Sections";

const TRUST = [
  { icon: Zap, label: "Instant analysis" },
  { icon: ShieldCheck, label: "No ads, no trackers" },
  { icon: Clapperboard, label: "MP4 up to 1080p" },
  { icon: Music4, label: "MP3 up to 320kbps" },
];

export default function Home() {
  return (
    <div id="top" className="flex min-h-dvh flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ---------------- Hero ---------------- */}
        <section className="relative mx-auto w-full max-w-4xl px-4 pb-6 pt-14 sm:px-6 sm:pt-20">
          <div className="animate-fade-up text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              v1.0 · ad-free forever
            </span>

            <h1 className="mt-6 text-balance text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
              <span className="text-gradient">CholeyTube</span>
              <span className="mt-2 block text-2xl font-bold text-slate-200 sm:text-3xl md:text-4xl">
                Fast &amp; Clean YouTube Downloader
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
              Paste any YouTube link and get the thumbnail, title, duration and channel instantly —
              then grab it as MP4 up to 1080p or MP3 up to 320 kbps. No pop-ups, no redirects, no
              nonsense.
            </p>
          </div>

          <div
            className="animate-fade-up mt-9"
            style={{ animationDelay: "120ms" }}
          >
            <Downloader />
          </div>

          <ul
            className="animate-fade-in mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
            style={{ animationDelay: "260ms" }}
          >
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon className="h-3.5 w-3.5 text-brand-400/80" />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------- Content ---------------- */}
        <div className="mx-auto w-full max-w-6xl space-y-24 px-4 py-20 sm:px-6 sm:py-24">
          <HowItWorks />
          <FeatureGrid />
          <Faq />

          {/* ---------------- CTA ---------------- */}
          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/20 via-ink-900 to-accent-500/15 px-6 py-12 text-center sm:px-12">
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-accent-500/20 blur-3xl" />
            <h2 className="relative text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Ready when you are.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-slate-300">
              Scroll back up, paste a link, and CholeyTube handles the rest in under a second.
            </p>
            <a
              href="#top"
              className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-ink-950 shadow-xl shadow-black/30 transition hover:bg-slate-100"
            >
              Paste a link
            </a>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
