import { Code2, Play } from "lucide-react";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-600/30 transition group-hover:scale-105">
            <Play className="h-4 w-4 fill-white text-white" />
          </span>
          <span className="text-base font-bold tracking-tight text-white">
            Choley<span className="text-brand-400">Tube</span>
          </span>
        </a>

        <ul className="ml-6 hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-slate-400 transition hover:text-white"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            API online
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Source</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
