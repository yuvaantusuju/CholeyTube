import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CholeyTube — Yoink any video",
  description:
    "Paste a link, pick a format, download. A clean, ad-free YouTube & 1800+ site downloader powered by yt-dlp.",
  openGraph: {
    title: "CholeyTube",
    description: "Yoink any video. Paste. Pick. Download. No ads.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
