import {
  BadgeCheck,
  Ban,
  Cpu,
  FileAudio2,
  Gauge,
  Link2,
  ListChecks,
  MousePointerClick,
  Play,
  Shield,
  Smartphone,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: Ban,
    title: "Zero ads, zero pop-ups",
    body: "No interstitials, no fake download buttons, no redirect chains. Just the interface you came for.",
  },
  {
    icon: Gauge,
    title: "Sub-second analysis",
    body: "Metadata is fetched server-side and cached for 5 minutes, so repeat lookups are instant.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first layout",
    body: "The quality table collapses into thumb-friendly cards below 640px — no pinch-zooming.",
  },
  {
    icon: FileAudio2,
    title: "MP4 + MP3 ladders",
    body: "1080p / 720p / 480p / 360p video and 320 / 256 / 128 kbps audio, each with a size estimate.",
  },
  {
    icon: Shield,
    title: "Requests stay server-side",
    body: "Every upstream call is proxied through /api/download with browser-like headers and CORS control.",
  },
  {
    icon: Cpu,
    title: "Swappable resolver",
    body: "The extraction layer is a single adapter — plug in any backend you are licensed to run.",
  },
];

const STEPS = [
  {
    icon: Link2,
    title: "Paste the link",
    body: "Copy any watch, share, shorts or embed URL. CholeyTube normalises all of them to a canonical video id.",
  },
  {
    icon: ListChecks,
    title: "We analyse it",
    body: "The API validates the URL, pulls title / channel / duration / thumbnail, and builds the quality ladder.",
  },
  {
    icon: MousePointerClick,
    title: "Pick a quality",
    body: "Switch between the MP4 and MP3 tabs, check the estimated size, and start your transfer in one tap.",
  },
];

const FAQS = [
  {
    q: "Which link formats are supported?",
    a: "youtube.com/watch?v=…, youtu.be/…, /shorts/…, /embed/…, /live/…, music.youtube.com and youtube-nocookie.com. You can even paste a bare 11-character video id.",
  },
  {
    q: "Why do some rows say “Preview mode”?",
    a: "CholeyTube ships the full pipeline — validation, metadata, quality ladder, size estimation and the download UI — but no bundled extractor. Set the RESOLVER_ENDPOINT environment variable to attach an extraction backend you are licensed to operate, and the rows light up automatically.",
  },
  {
    q: "How are file sizes calculated?",
    a: "When the resolver reports a real content-length we show it verbatim. Otherwise we estimate with bitrate × duration and prefix the number with a ~ so you always know which is which.",
  },
  {
    q: "Is anything stored?",
    a: "No database, no accounts, no logs of your links. Results live in a 5-minute in-memory cache on the server, and your recent lookups stay in your own browser's localStorage.",
  },
  {
    q: "Can I use this on copyrighted videos?",
    a: "Only download content you own or that is explicitly licensed for reuse — for example Creative Commons uploads or your own channel. Respect YouTube's Terms of Service and your local copyright law.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="scroll-mt-24">
      <SectionHeading
        eyebrow="Why CholeyTube"
        title="Built like a product, not a link farm"
        subtitle="Every detail is tuned for speed and clarity — from the first paste to the final tap."
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <article
            key={title}
            className="glass group rounded-2xl border border-white/10 p-5 transition hover:-translate-y-0.5 hover:border-brand-400/30"
          >
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-brand-300 transition group-hover:from-brand-500/30 group-hover:to-accent-500/30">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24">
      <SectionHeading
        eyebrow="How it works"
        title="Three taps from link to file"
        subtitle="No sign-up, no captcha, no “wait 20 seconds” timer."
      />
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, index) => (
          <li
            key={title}
            className="glass relative overflow-hidden rounded-2xl border border-white/10 p-5"
          >
            <span className="absolute -right-3 -top-5 text-7xl font-black text-white/[0.04]">
              {index + 1}
            </span>
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-accent-400">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24">
      <SectionHeading
        eyebrow="FAQ"
        title="Questions, answered"
        subtitle="The short version: fast, private, and honest about what it does."
      />
      <div className="mx-auto mt-8 max-w-3xl space-y-3">
        {FAQS.map((item, index) => (
          <details
            key={item.q}
            open={index === 0}
            className="group glass rounded-2xl border border-white/10 px-5 py-4 transition hover:border-white/20 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-white">
              {item.q}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-400 transition group-open:rotate-45 group-open:border-brand-400/40 group-open:text-brand-300">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600">
              <Play className="h-3.5 w-3.5 fill-white text-white" />
            </span>
            <span className="text-sm font-bold text-white">
              Choley<span className="text-brand-400">Tube</span>
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            A clean, ad-free downloader interface built with Next.js App Router, TypeScript,
            Tailwind CSS, Axios and Lucide icons.
          </p>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-600">
            <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Download only content you own or that is licensed for reuse. CholeyTube is not
            affiliated with YouTube or Google.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-xs sm:grid-cols-3">
          <FooterCol
            title="Product"
            links={[
              { label: "How it works", href: "#how" },
              { label: "Features", href: "#features" },
              { label: "FAQ", href: "#faq" },
            ]}
          />
          <FooterCol
            title="API"
            links={[
              { label: "GET /api/download", href: "/api/download" },
              { label: "GET /api/health", href: "/api/health" },
            ]}
          />
          <FooterCol
            title="Stack"
            links={[
              { label: "Next.js 16", href: "https://nextjs.org" },
              { label: "Tailwind CSS 4", href: "https://tailwindcss.com" },
              { label: "Lucide Icons", href: "https://lucide.dev" },
            ]}
          />
        </div>
      </div>

      <div className="border-t border-white/5 px-4 py-4 text-center text-[11px] text-slate-600 sm:px-6">
        © {new Date().getFullYear()} CholeyTube · Built for speed, shipped without ads.
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-slate-400 transition hover:text-brand-300"
              {...(link.href.startsWith("http")
                ? { target: "_blank", rel: "noreferrer noopener" }
                : {})}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <Sparkles className="h-3 w-3 text-brand-400" />
        {eyebrow}
      </span>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm text-slate-400 sm:text-base">{subtitle}</p>
    </div>
  );
}
