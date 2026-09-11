import { initConversion, checkProgress, type Format } from "./converter";
import crypto from "node:crypto";

export type JobStatus =
  | "checking"
  | "extracting"
  | "converting"
  | "ready"
  | "error";

export type Job = {
  id: string;
  videoId: string;
  format: Format;
  title: string;
  status: JobStatus;
  progress: number; // 0..3
  progressUrl: string;
  downloadUrl: string;
  error?: string;
  errorCode?: number;
  createdAt: number;
  updatedAt: number;
};

// Global job store. We keep jobs in memory so the same instance can poll
// progress for them. Jobs auto-expire after 15 minutes.
type JobStore = Map<string, Job>;

const globalForJobs = globalThis as unknown as { __jobStore?: JobStore };

const store: JobStore = globalForJobs.__jobStore ?? new Map();
if (!globalForJobs.__jobStore) globalForJobs.__jobStore = store;

const TTL_MS = 15 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [id, job] of store) {
    if (now - job.updatedAt > TTL_MS) store.delete(id);
  }
}

export function listJobs(): Job[] {
  cleanup();
  return Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getJob(id: string): Job | undefined {
  cleanup();
  return store.get(id);
}

export async function createJob(
  videoId: string,
  format: Format,
  initialTitle?: string,
): Promise<Job> {
  const id = crypto.randomBytes(8).toString("hex");
  const init = await initConversion(videoId, format);
  const now = Date.now();

  if (!init.ok) {
    const job: Job = {
      id,
      videoId,
      format,
      title: initialTitle ?? "video",
      status: "error",
      progress: 0,
      progressUrl: "",
      downloadUrl: "",
      error: init.error,
      errorCode: init.code,
      createdAt: now,
      updatedAt: now,
    };
    store.set(id, job);
    return job;
  }

  const job: Job = {
    id,
    videoId,
    format,
    title: initialTitle && initialTitle !== "Untitled video" ? initialTitle : init.title,
    status: "checking",
    progress: 0,
    progressUrl: init.progressUrl,
    downloadUrl: init.downloadUrl,
    createdAt: now,
    updatedAt: now,
  };
  store.set(id, job);
  return job;
}

export async function tickJob(id: string): Promise<Job | undefined> {
  const job = store.get(id);
  if (!job) return undefined;
  if (job.status === "ready" || job.status === "error") return job;

  const now = Date.now();

  // If init gave us a direct download URL, we're done already.
  if (job.progressUrl === "" && job.downloadUrl !== "") {
    const updated: Job = {
      ...job,
      status: "ready",
      progress: 3,
      updatedAt: now,
    };
    store.set(id, updated);
    return updated;
  }

  if (!job.progressUrl) {
    const updated: Job = {
      ...job,
      status: "error",
      error: "No progress URL available for this job.",
      errorCode: 502,
      updatedAt: now,
    };
    store.set(id, updated);
    return updated;
  }

  const result = await checkProgress(job.progressUrl, job.title);
  if (!result.ok) {
    const updated: Job = {
      ...job,
      status: "error",
      error: result.error,
      errorCode: result.code,
      updatedAt: now,
    };
    store.set(id, updated);
    return updated;
  }

  const status: JobStatus =
    result.progress >= 3
      ? "ready"
      : result.progress === 2
        ? "converting"
        : result.progress === 1
          ? "extracting"
          : "checking";

  const updated: Job = {
    ...job,
    status,
    progress: result.progress,
    title: result.title || job.title,
    downloadUrl: result.downloadUrl || job.downloadUrl,
    updatedAt: now,
  };
  store.set(id, updated);
  return updated;
}
