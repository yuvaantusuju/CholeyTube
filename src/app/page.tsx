import Downloader from "./downloader";

export default function HomePage() {
  return (
    <main className="app min-h-screen flex flex-col">
      <header className="px-6 sm:px-10 pt-8 pb-4 flex items-center justify-between">
        <a href="/" className="logo" aria-label="CholeyTube home">
          <span className="logo-mark" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M8 5v14l11-7L8 5z" fill="white" />
            </svg>
          </span>
          <span>
            Choley<span style={{ color: "var(--accent)" }}>Tube</span>
          </span>
        </a>
        <a
          href="https://github.com/pablostanley/yoinks"
          target="_blank"
          rel="noreferrer noopener"
          className="pill"
          title="Inspired by yoinks"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 .5C5.7.5.7 5.5.7 11.8c0 5 3.2 9.2 7.7 10.7.6.1.8-.2.8-.6v-2.1c-3.1.7-3.8-1.5-3.8-1.5-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.2-5.1-5.5 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.5.1-3 0 0 .9-.3 3 1.1.9-.2 1.8-.4 2.7-.4.9 0 1.8.1 2.7.4 2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.7.1 3 .7.8 1.1 1.8 1.1 3 0 4.3-2.6 5.2-5.1 5.5.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.7-5.7 7.7-10.7C23.3 5.5 18.3.5 12 .5z" />
          </svg>
          Inspired by yoinks
        </a>
      </header>

      <div className="flex-1 px-4 sm:px-6 pb-16">
        <Downloader />
      </div>

      <footer className="px-6 sm:px-10 py-6 text-center text-xs text-[color:var(--fg-dim)]">
        CholeyTube uses yt-dlp. Only download content you have the right to keep.
        <br />
        Press <span className="kbd">Enter</span> in the input to yoink.
      </footer>
    </main>
  );
}
