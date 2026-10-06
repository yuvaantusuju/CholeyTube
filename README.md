# CholeyTube 🎬

A clean, ad-free web downloader for YouTube and 1,800+ sites. Paste a link, pick a
format, hit download. Files stream straight to your browser — nothing is stored.

Inspired by [yoinks](https://github.com/pablostanley/yoinks) — same great CLI,
but with a friendly web UI you can deploy for free on Render.

## Features

- 🎯 **Smart format picker** — shows available resolutions (144p → 4K) plus an
  MP3 audio-only option. Progressive MP4s are preferred; split video/audio
  streams are auto-merged with ffmpeg.
- 🔒 **No tracking, no ads** — files stream directly from the server to the user
  via `yt-dlp -o -`. Nothing is persisted to disk.
- 🌐 **Works with 1,800+ sites** — YouTube, X/Twitter, Instagram, TikTok,
  Reddit, Vimeo, SoundCloud and many more.
- ⚡ **Zero-config deploy** — one-click Blueprint on Render.
- 🎵 **MP3 extraction** — high-quality audio via bundled `ffmpeg-static`.

## Tech stack

- **Next.js 16** (App Router, Node runtime)
- **TypeScript** + **Tailwind CSS v4**
- **yt-dlp** via [`youtube-dl-exec`](https://www.npmjs.com/package/youtube-dl-exec)
  (binary downloaded automatically on first use)
- **ffmpeg-static** for merging and audio extraction
- **PostgreSQL** + **Drizzle ORM** (optional — used for a download audit log)

## Deploy to Render (1-click)

The repo ships a `render.yaml` Blueprint.

1. Push this repo to GitHub.
2. Go to [render.com → New → Blueprint](https://dashboard.render.com/select-repo?type=blueprint).
3. Connect your fork. Render will:
   - Provision a free PostgreSQL instance (`choleytube-db`).
   - Build and deploy the Next.js web service (`choleytube`).
   - Wire `DATABASE_URL` to the database automatically.
4. Wait ~2 minutes for the first build. Your app will be live at
   `https://choleytube.onrender.com` (or your custom subdomain).

> The free web service sleeps after 15 minutes of inactivity. The first request
> after a cold start takes a few extra seconds while the Node process boots.
> The `yt-dlp` binary is downloaded lazily and cached on disk.

### Manual deploy

If you'd rather wire things up by hand:

```bash
# 1. Create a Web Service on Render:
#    - Runtime: Node
#    - Build:   npm ci && npm run build
#    - Start:   npm run start
#    - Health:  /api/health
#
# 2. Add a free PostgreSQL instance and copy its connection string.
#
# 3. Set environment variables on the web service:
#      NODE_VERSION=20
#      NODE_ENV=production
#      DATABASE_URL=<from postgres>
#      NEXT_TELEMETRY_DISABLED=1
```

## Local development

```bash
git clone <your-fork>
cd choleytube
npm install

# Optional: start the local postgres
# (Render sets DATABASE_URL automatically in production)

npm run dev
```

Open <http://localhost:3000>, paste a URL, and yoink.

### Health check

```bash
curl http://localhost:3000/api/health
# → {"status":"ok"}
```

## API

| Method | Path           | Description                                       |
| ------ | -------------- | ------------------------------------------------- |
| `POST` | `/api/info`    | Body `{ "url": "..." }` → returns video metadata  |
| `GET`  | `/api/download`| Streams the file. Query: `url`, `format`, `kind`, `title`, `height?` |
| `GET`  | `/api/health`  | Health check                                      |

Example:

```bash
# Fetch info
curl -X POST http://localhost:3000/api/info \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Download (use the URL you got back from /api/info)
curl -OJ "http://localhost:3000/api/download?url=...&format=18&kind=video&title=Never%20Gonna%20Give%20You%20Up"
```

## How it works

1. **Browser** posts the URL to `/api/info`. The server invokes
   `yt-dlp --dump-single-json` and returns a curated list of formats.
2. **Browser** picks a format and triggers a download request to
   `/api/download`. The server spawns `yt-dlp -o -` and pipes the binary
   stdout straight to the response stream.
3. **yt-dlp** does the heavy lifting (HLS, DASH, muxing). ffmpeg (bundled via
   `ffmpeg-static`) merges split streams or extracts MP3 audio on the fly.
4. The browser receives a normal `Content-Disposition: attachment` response
   with a sanitized filename derived from the video title.

No proxying, no server-side storage, no rate-limiting logic (add it if you
ship this publicly — Render free tier has a single CPU).

## Configuration

| Env var                    | Default | Description                              |
| -------------------------- | ------- | ---------------------------------------- |
| `DATABASE_URL`             | (required in prod) | PostgreSQL connection string    |
| `NODE_VERSION`             | 20      | Render Node version                      |
| `NEXT_TELEMETRY_DISABLED`  | 1       | Disable Next.js telemetry                |
| `YT_DLP_SKIP_DOWNLOAD`     | 1       | Disable yt-dlp's own auto-update check   |

## Fair use

CholeyTube is a personal archiving tool. Downloading content may violate a
platform's terms of service — only download what you have the right to keep,
and be excellent to creators. 🫶

## License

MIT.
