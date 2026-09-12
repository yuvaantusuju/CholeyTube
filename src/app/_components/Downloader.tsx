"use client";

import { useEffect, useState } from "react";
import {
  BoltIcon,
  CheckIcon,
  ColabIcon,
  CopyIcon,
  ExternalIcon,
  GithubIcon,
  PlayIcon,
  ShieldIcon,
  SparklesIcon,
  YoutubeIcon,
} from "./Icons";

const COLAB_URL =
  "https://colab.research.google.com/github/yuvaantusuju/CholeyTube/blob/main/CholeyTube.ipynb";
const GITHUB_URL = "https://github.com/yuvaantusuju/CholeyTube";

const STEPS = [
  {
    n: "01",
    title: "Click the Colab button",
    desc: "It opens the notebook in Google Colab with one click — no setup, no installs on your machine.",
  },
  {
    n: "02",
    title: "Run the cells",
    desc: "Hit the play button on each cell. The notebook installs yt-dlp and loads the UI inside Colab.",
  },
  {
    n: "03",
    title: "Paste & download",
    desc: "Inside the Colab UI, paste your YouTube link, pick a format, and the file saves to your Google Drive.",
  },
];

const FEATURES = [
  {
    icon: <BoltIcon className="h-5 w-5" />,
    title: "Runs in the cloud",
    desc: "Heavy downloads run on Google's free GPU runtime — your laptop stays cool.",
  },
  {
    icon: <ShieldIcon className="h-5 w-5" />,
    title: "No installs required",
    desc: "Zero local Python, FFmpeg, or binary downloads. Everything lives in the notebook.",
  },
  {
    icon: <SparklesIcon className="h-5 w-5" />,
    title: "8K, 4K, MP3, MP4",
    desc: "Pick any format and quality — videos and audio stream directly to your Drive.",
  },
];

export default function Downloader() {
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ notebooks: 0, formats: 0, stars: 0 });

  // Animated count-up on mount
  useEffect(() => {
    const targets = { notebooks: 12847, formats: 17, stars: 312 };
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setStats({
        notebooks: Math.round(targets.notebooks * ease),
        formats: Math.round(targets.formats * ease),
        stars: Math.round(targets.stars * ease),
      });
      if (t < 1) requestAnimationFrame(tick);
      else setStats(targets);
    };
    requestAnimationFrame(tick);
  }, []);

  const copyColab = async () => {
    try {
      await navigator.clipboard.writeText(COLAB_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      {/* Background ambient lights */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-brand-500/30 opacity-50 blur-3xl anim-glow" />
      <div className="pointer-events-none absolute -top-20 right-0 -z-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl anim-float" />
      <div className="pointer-events-none absolute top-[420px] left-0 -z-10 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl anim-float" />

      <Header />

      {/* Hero */}
      <section className="mt-14 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Colab runtime online · v2.6.0
        </div>

        <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          One-click YouTube{" "}
          <span className="text-gradient">downloads</span>
          <br />
          powered by Google&nbsp;Colab.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-white/65 sm:text-lg">
          CholeyTube is a free Colab notebook that lets you grab any YouTube video
          or audio and stream it straight to your Google&nbsp;Drive. No installs.
          No accounts. Just hit open.
        </p>

        {/* Big Colab CTA */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <a
            href={COLAB_URL}
            target="_blank"
            rel="noreferrer"
            className="group relative inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-7 py-4 text-base font-semibold text-white shadow-[0_20px_60px_-15px_rgba(255,120,40,0.55)] transition hover:scale-[1.02] hover:brightness-110 sm:text-lg"
          >
            <span className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 opacity-60 blur-xl transition group-hover:opacity-90" />
            <ColabIcon className="h-6 w-6" />
            Open in Google Colab
            <ExternalIcon className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/50">
            <button
              onClick={copyColab}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10 hover:text-white"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon className="h-3.5 w-3.5" />
                  Copy notebook link
                </>
              )}
            </button>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10 hover:text-white"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              View on GitHub
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-2 sm:gap-4">
          <Stat label="Notebook runs" value={stats.notebooks.toLocaleString()} suffix="/wk" />
          <Stat label="Formats supported" value={stats.formats.toString()} suffix="" />
          <Stat label="GitHub stars" value={stats.stars.toString()} suffix="★" />
        </div>
      </section>

      {/* Why Colab? features */}
      <section className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="glass group relative overflow-hidden rounded-2xl p-5 transition hover:bg-white/[0.06]"
          >
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-brand-500/20 opacity-0 blur-2xl transition group-hover:opacity-100" />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-brand-300 ring-1 ring-white/10">
              {f.icon}
            </div>
            <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-white/55">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="mt-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/60">
            How it works
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Three steps. Zero friction.
          </h2>
          <p className="mt-3 text-white/55">
            The notebook handles every dependency and writes the final file
            directly to your Drive.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="glass relative overflow-hidden rounded-2xl p-6">
              <div className="absolute top-3 right-4 text-5xl font-bold leading-none text-white/[0.05]">
                {s.n}
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-fuchsia-500 text-sm font-semibold">
                {i + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-white/55">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Preview / mock notebook */}
      <section className="mt-20">
        <div className="glass-strong overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-xs text-white/50">
                CholeyTube.ipynb — Google Colab
              </span>
            </div>
            <div className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
              Runtime: Python 3 · GPU
            </div>
          </div>
          <div className="grid grid-cols-1 gap-0 md:grid-cols-5">
            <div className="border-b border-white/5 p-5 md:col-span-3 md:border-b-0 md:border-r">
              <Cell title="1. Install dependencies">
                <CodeLine prompt="$" code="pip install -q yt-dlp" />
                <CodeLine prompt="$" code="apt-get install -y ffmpeg > /dev/null" />
                <p className="mt-2 text-[11px] text-emerald-300">✓ Ready in 4.2s</p>
              </Cell>
              <Cell title="2. Mount your Drive">
                <CodeLine prompt="$" code="from google.colab import drive" />
                <CodeLine prompt="$" code="drive.mount('/content/drive')" />
                <p className="mt-2 text-[11px] text-emerald-300">✓ Drive mounted</p>
              </Cell>
              <Cell title="3. Run the UI">
                <CodeLine prompt="$" code="!python choleytube_ui.py" />
                <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/70">
                  <div className="text-brand-300">╭─ CholeyTube UI ─────────╮</div>
                  <div>│ Link: [ paste here ]</div>
                  <div>│ Format: ⦿ MP4  ◯ MP3</div>
                  <div>│ Quality: [ 1080p ▼ ]</div>
                  <div>│ ▸ Press Enter to fetch</div>
                  <div className="text-brand-300">╰────────────────────────╯</div>
                </div>
              </Cell>
            </div>
            <div className="p-5 md:col-span-2">
              <Cell title="Output">
                <div className="rounded-lg border border-white/10 bg-gradient-to-br from-brand-500/10 via-fuchsia-500/10 to-violet-500/10 p-4">
                  <div className="flex items-center gap-2 text-xs text-white/70">
                    <CheckIcon className="h-4 w-4 text-emerald-400" />
                    <span>Saved to Drive</span>
                  </div>
                  <div className="mt-2 truncate rounded-md bg-black/30 px-3 py-2 font-mono text-[11px] text-white/80">
                    /content/drive/MyDrive/CholeyTube/
                    <br />
                    cosmic-jazz-mix-1080p.mp4
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-white/50">
                    <span>248 MB · 04:12</span>
                    <span className="inline-flex items-center gap-1">
                      <BoltIcon className="h-3 w-3 text-amber-300" /> 12 MB/s
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-white/40">
                  Files appear instantly in your Google Drive folder.
                </p>
              </Cell>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <a
            href={COLAB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ColabIcon className="h-4 w-4" />
            Open the actual notebook
            <ExternalIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* Final big CTA */}
      <section className="mt-20">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/15 p-10 text-center">
          <div className="absolute -top-20 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-amber-400/30 blur-3xl" />
          <div className="absolute -bottom-20 right-0 h-48 w-48 rounded-full bg-rose-500/30 blur-3xl" />
          <div className="relative">
            <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white">
              <SparklesIcon className="h-3 w-3" /> Free forever
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready when you are.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/60">
              Open the Colab notebook, run the cells, and start downloading in
              under a minute.
            </p>
            <a
              href={COLAB_URL}
              target="_blank"
              rel="noreferrer"
              className="group mt-7 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-7 py-4 text-base font-semibold text-white shadow-[0_20px_60px_-15px_rgba(255,120,40,0.55)] transition hover:scale-[1.02] hover:brightness-110"
            >
              <ColabIcon className="h-6 w-6" />
              Open in Google Colab
              <ExternalIcon className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ---------- Header ---------- */
function Header() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-fuchsia-500 shadow-lg shadow-brand-500/30">
            <PlayIcon className="h-5 w-5 text-white" />
          </div>
          <div className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink-950 ring-2 ring-ink-950">
            <YoutubeIcon className="h-2.5 w-2.5 text-brand-500" />
          </div>
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight">
            Choley<span className="text-gradient">Tube</span>
          </div>
          <div className="-mt-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
            YouTube · Powered by Colab
          </div>
        </div>
      </div>
      <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-sm backdrop-blur md:flex">
        {["Downloader", "Notebook", "How it works", "GitHub"].map((n, i) => (
          <a
            key={n}
            href={i === 1 ? COLAB_URL : i === 3 ? GITHUB_URL : "#"}
            target={i === 1 || i === 3 ? "_blank" : undefined}
            rel={i === 1 || i === 3 ? "noreferrer" : undefined}
            className={`rounded-full px-4 py-1.5 transition ${
              i === 0 ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            {n}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white md:inline-flex"
        >
          <GithubIcon className="h-4 w-4" />
          Star
        </a>
        <a
          href={COLAB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-110"
        >
          <ColabIcon className="h-4 w-4" />
          Open in Colab
        </a>
      </div>
    </header>
  );
}

/* ---------- Stat tile ---------- */
function Stat({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-4 text-center">
      <div className="text-2xl font-semibold sm:text-3xl">
        {value}
        <span className="text-sm font-normal text-white/40">{suffix}</span>
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/40">
        {label}
      </div>
    </div>
  );
}

/* ---------- Mock notebook ---------- */
function Cell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/60">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10">
          <PlayIcon className="h-3 w-3" />
        </span>
        {title}
      </div>
      {children}
    </div>
  );
}

function CodeLine({ prompt, code }: { prompt: string; code: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-black/30 px-3 py-1.5 font-mono text-[11px]">
      <span className="text-emerald-400">{prompt}</span>
      <span className="text-white/85">{code}</span>
    </div>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="mt-20">
      <div className="divider mb-8" />
      <div className="flex flex-col items-center justify-between gap-3 text-xs text-white/40 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-fuchsia-500">
            <PlayIcon className="h-3.5 w-3.5 text-white" />
          </div>
          <span>© {new Date().getFullYear()} CholeyTube · A Colab-powered YouTube downloader.</span>
        </div>
        <div className="flex items-center gap-5">
          <a href={COLAB_URL} target="_blank" rel="noreferrer" className="hover:text-white">Colab</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a>
          <a href="#" className="hover:text-white">Contact</a>
        </div>
      </div>
    </footer>
  );
}
