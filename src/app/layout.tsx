import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CholeyTube — YouTube Downloader",
  description:
    "Paste a YouTube link, pick a format, and grab the video as MP4 or MP3. Powered by y2mate.gs.",
};

export const viewport: Viewport = {
  themeColor: "#05010f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
