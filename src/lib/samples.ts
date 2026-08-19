/**
 * Openly-licensed sample media.
 *
 * These exist so the download pipeline is provably working end-to-end even
 * when no extraction backend is attached. Every asset below is published under
 * a licence that explicitly permits redistribution.
 */

export interface SampleAsset {
  id: string;
  kind: "video" | "audio";
  label: string;
  description: string;
  container: "mp4" | "mp3";
  url: string;
  approxSizeBytes: number | null;
  /** When set, this sample is produced by merging two tracks through ffmpeg. */
  audioUrl?: string;
}

export const SAMPLE_CREDIT = {
  title: "Big Buck Bunny",
  author: "Blender Foundation",
  licence: "CC BY 3.0",
  licenceUrl: "https://creativecommons.org/licenses/by/3.0/",
  sourceUrl: "https://peach.blender.org/",
};

const BASE = "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264";

/** Each URL below was verified to return HTTP 200 with a real content-length. */
export const SAMPLE_ASSETS: SampleAsset[] = [
  {
    id: "sample-mp4-1080",
    kind: "video",
    label: "1080p",
    description: "Full HD · MP4 · CC BY 3.0",
    container: "mp4",
    url: `${BASE}/1080/Big_Buck_Bunny_1080_10s_5MB.mp4`,
    approxSizeBytes: 5_238_714,
  },
  {
    id: "sample-mp4-720",
    kind: "video",
    label: "720p",
    description: "HD · MP4 · CC BY 3.0",
    container: "mp4",
    url: `${BASE}/720/Big_Buck_Bunny_720_10s_2MB.mp4`,
    approxSizeBytes: 1_978_137,
  },
  {
    id: "sample-mp4-360",
    kind: "video",
    label: "360p",
    description: "Data saver · MP4 · CC BY 3.0",
    container: "mp4",
    url: `${BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`,
    approxSizeBytes: 991_017,
  },
  {
    // Exercises the ffmpeg merge path: video from the 1080p file, audio from
    // the 360p file, recombined on the fly into a single MP4.
    id: "sample-mux-1080",
    kind: "video",
    label: "1080p merged",
    description: "ffmpeg merge test · MP4 · CC BY 3.0",
    container: "mp4",
    url: `${BASE}/1080/Big_Buck_Bunny_1080_10s_5MB.mp4`,
    audioUrl: `${BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`,
    approxSizeBytes: null,
  },
];
