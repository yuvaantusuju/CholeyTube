import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages spawn native binaries (yt-dlp / ffmpeg) via absolute paths,
  // so they must be required from `node_modules` at runtime instead of bundled.
  serverExternalPackages: [
    "yt-dlp-exec",
    "fluent-ffmpeg",
    "ffmpeg-static",
    "ffprobe-static",
  ],
};

export default nextConfig;
