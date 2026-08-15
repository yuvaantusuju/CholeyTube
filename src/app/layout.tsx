import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CholeyTube — YouTube to MP3 & MP4 Downloader",
  description:
    "Download YouTube videos in up to 4K MP4 or convert any video, Short, or playlist to high-quality MP3 (128 / 192 / 320 kbps) — fast, free, and private.",
  applicationName: "CholeyTube",
  keywords: [
    "youtube downloader",
    "youtube to mp3",
    "youtube to mp4",
    "yt-dlp",
    "youtube converter",
    "4k video download",
  ],
  openGraph: {
    title: "CholeyTube — YouTube to MP3 & MP4 Downloader",
    description:
      "Convert YouTube videos to MP3 or download MP4 up to 4K in seconds.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07070d] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
