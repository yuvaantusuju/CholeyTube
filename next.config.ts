import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yt-dlp-exec ships its own binary and is only used server-side in routes.
  serverExternalPackages: ["yt-dlp-exec"],
};

export default nextConfig;
