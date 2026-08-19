# CholeyTube — Fast & Clean YouTube Downloader

A modern, dark-themed, mobile-first YouTube downloader interface built with the
**Next.js App Router**, **TypeScript**, **Tailwind CSS 4**, **Axios** and **Lucide icons**.
No database, no accounts, no ads.

---

## 1. Folder structure

```
.
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── download/route.ts   # POST resolve · GET capabilities · OPTIONS CORS
│   │   │   └── health/route.ts     # liveness probe
│   │   ├── globals.css             # theme tokens, animations, ambient backdrop
│   │   ├── layout.tsx              # metadata, viewport, dark shell
│   │   └── page.tsx                # hero + sections composition (server component)
│   ├── components/
│   │   ├── Downloader.tsx          # client orchestrator: input / loading / result / error
│   │   ├── UrlInputBar.tsx         # input + Paste + Clear + Download/Convert
│   │   ├── ResultSkeleton.tsx      # animated shimmer skeleton + step indicator
│   │   ├── ResultPanel.tsx         # card + notice + table + meta footer
│   │   ├── VideoCard.tsx           # thumbnail, title, duration, channel
│   │   ├── DownloadTable.tsx       # MP4 / MP3 tabs + responsive links table
│   │   ├── ErrorBanner.tsx         # graceful, typed error messages
│   │   ├── Navbar.tsx              # sticky glass nav
│   │   └── Sections.tsx            # HowItWorks · FeatureGrid · Faq · Footer
│   └── lib/
│       ├── types.ts                # shared API/UI contracts
│       ├── youtube.ts              # URL parsing, id extraction, formatters
│       ├── formats.ts              # quality ladder + bitrate size estimation
│       ├── metadata.ts             # YouTube oEmbed / Data API v3 metadata
│       ├── resolver.ts             # pluggable download-link resolver adapter
│       ├── http.ts                 # Axios client with browser-like headers
│       └── cache.ts                # in-memory TTL cache + rate limiter
└── README.md
```

## 2. API

### `POST /api/download`

```jsonc
// request
{ "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }

// 200 response
{
  "ok": true,
  "data": {
    "videoId": "dQw4w9WgXcQ",
    "title": "…",
    "channel": "…",
    "thumbnail": "https://i.ytimg.com/…",
    "durationSeconds": 213,
    "durationLabel": "3:33",
    "mode": "preview",
    "formats": [
      { "id": "mp4-1080", "kind": "video", "label": "1080p", "approxSizeBytes": 111825000,
        "estimated": true, "available": false, "url": null }
      // … 720p, 480p, 360p, 320/256/128 kbps
    ]
  }
}
```

Failures return `{ ok: false, error: { code, message, hint } }` with typed codes:
`EMPTY_INPUT`, `INVALID_URL`, `NOT_YOUTUBE`, `VIDEO_UNAVAILABLE`, `UPSTREAM_ERROR`,
`UPSTREAM_TIMEOUT`, `RATE_LIMITED`, `BAD_REQUEST`, `INTERNAL_ERROR`.

Also implemented: `GET /api/download` (capability probe) and `OPTIONS /api/download`
(CORS pre-flight). Every response carries `Access-Control-Allow-*` headers, and the
route applies a 20 req/min per-IP fixed-window limit plus a 5-minute result cache.

## 3. Environment variables (all optional)

| Variable                   | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `YOUTUBE_API_KEY`          | Enables Data API v3 metadata (adds exact duration). Falls back to oEmbed. |
| `RESOLVER_ENDPOINT`        | HTTP service that returns real download links (see contract below).       |
| `RESOLVER_TOKEN`           | Bearer token sent to the resolver.                                        |
| `RESOLVER_REFERENCE_HOST`  | Reference host shown in the UI (default `https://v32.www-y2mate.com`).    |
| `ALLOWED_ORIGIN`           | CORS allow-list origin (default `*`).                                     |

### Resolver contract

```jsonc
// POST $RESOLVER_ENDPOINT   { "videoId": "…", "url": "https://www.youtube.com/watch?v=…" }
{ "formats": [ { "id": "1080p", "kind": "video", "url": "https://…", "sizeBytes": 111825000 } ] }
```

Ids are normalised (`1080p` / `mp4-1080`, `320kbps` / `mp3-320`), so most
y2mate-compatible workers can be adapted with a thin shim. Outbound calls are made
through `src/lib/http.ts`, which sets `User-Agent`, `Referer`, `Origin`,
`Accept-Language` and `Sec-Fetch-*` headers so upstream hosts treat the request like a
normal browser session.

**Without a resolver configured the app runs in preview mode:** real metadata, the real
quality ladder and bitrate-based size estimates, with inert links. CholeyTube
deliberately does not bundle an extractor that bypasses YouTube's delivery protections —
attach a backend you are licensed to operate, and only download content you own or that
is licensed for reuse.

## 4. Why "Download" does nothing (and how to fix it)

Two separate things had to be right:

1. **A link has to exist.** In preview mode every row is `url: null`, so the buttons are
   disabled. Set `RESOLVER_ENDPOINT` to populate them.
2. **The browser has to save the file.** The `download` attribute on `<a>` is *ignored*
   for cross-origin URLs, so a direct link just opens the media in a tab. Every download
   is therefore routed through `GET /api/download/stream`, which pipes the file through
   this origin and sets `Content-Disposition: attachment`.

### `GET /api/download/stream`

| Query | Meaning                                  |
| ----- | ---------------------------------------- |
| `u`   | base64url-encoded target URL             |
| `s`   | HMAC-SHA256 signature of `u`             |
| `n`   | desired filename                         |

Only URLs signed by this server are accepted (`lib/sign.ts`), and loopback / RFC-1918
ranges are rejected, so the route cannot be abused as an open proxy or SSRF vector.
`Range` headers are forwarded, so seeking and resuming work.

**Verify it right now:** analyse any link and use the green *"These actually download"*
panel. Those are Big Buck Bunny files (© Blender Foundation, CC BY 3.0) served through
the exact same proxy — clicking one saves a real MP4. If those work, your download path
is healthy and the only missing piece is a resolver.

### Attaching the bundled resolver sidecar

`resolver/server.mjs` is a dependency-free HTTP service that implements the contract
above by delegating to [`yt-dlp`](https://github.com/yt-dlp/yt-dlp). Extraction therefore
runs as a separate process on your machine, under your control.

```bash
# 1. install yt-dlp
pipx install yt-dlp          # or: brew install yt-dlp

# 2. start the sidecar (defaults to port 8080)
node resolver/server.mjs

# 3. start CholeyTube pointed at it
RESOLVER_ENDPOINT=http://127.0.0.1:8080/resolve npm run start
```

It selects **progressive** (audio+video muxed) streams for the MP4 rungs, so files save
directly with no client-side muxing, and maps each MP3 rung to the nearest audio-only
stream. Set `RESOLVER_TOKEN` on both processes to require bearer auth.

Once it's running, the rows light up and downloads flow through
`/api/download/stream` exactly like the verified sample files.

Please keep this to content you own, have permission to download, or that is openly
licensed, and check YouTube's Terms of Service for your use case.

## 5. Scripts



```bash
npm run dev        # local development
npm run build      # production build
npm run start      # production server
npm run typecheck  # tsc --noEmit
```
