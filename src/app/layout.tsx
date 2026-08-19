import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CholeyTube — Fast & Clean YouTube Downloader",
  description:
    "CholeyTube is a fast, ad-free interface for grabbing YouTube video metadata and preparing MP4 / MP3 downloads in one click.",
  applicationName: "CholeyTube",
  keywords: ["CholeyTube", "YouTube downloader", "MP4", "MP3", "converter", "Next.js"],
  openGraph: {
    title: "CholeyTube — Fast & Clean YouTube Downloader",
    description: "Paste a link, pick a quality, done. No ads, no clutter, no pop-ups.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05050a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-backdrop bg-ink-950 text-slate-200 antialiased selection:text-white">
        {children}
      </body>
    </html>
  );
}
