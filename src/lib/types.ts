export type DownloadMode = "mp3" | "mp4";

export interface VideoInfo {
  id: string;
  title: string;
  channel: string;
  channelUrl: string | null;
  duration: number | null;
  durationLabel: string;
  thumbnail: string | null;
  viewCount: number | null;
  uploadDate: string | null;
  isLive: boolean;
  isShort: boolean;
  isPlaylist: boolean;
  playlistTitle: string | null;
  playlistCount: number | null;
  webpageUrl: string;
}

export const MP3_QUALITIES = [
  { value: "128", label: "128 kbps", hint: "Fast · Standard" },
  { value: "192", label: "192 kbps", hint: "Medium" },
  { value: "320", label: "320 kbps", hint: "High quality" },
] as const;

export const MP4_QUALITIES = [
  { value: "360", label: "360p", hint: "Small" },
  { value: "480", label: "480p", hint: "SD" },
  { value: "720", label: "720p", hint: "HD" },
  { value: "1080", label: "1080p", hint: "Full HD" },
  { value: "2160", label: "4K", hint: "Ultra HD" },
] as const;
