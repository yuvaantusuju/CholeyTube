import { NextRequest, NextResponse } from "next/server";
import { parseYouTubeUrl } from "@/lib/youtube";
import { createJob, tickJob, getJob } from "@/lib/job-store";

export const dynamic = "force-dynamic";

type Body = {
  url?: string;
  format?: string;
  videoTitle?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { url, format, videoTitle } = body;
  if (!url || !format) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields." },
      { status: 400 },
    );
  }

  if (format !== "mp3" && format !== "mp4") {
    return NextResponse.json(
      { ok: false, error: "Format must be 'mp3' or 'mp4'." },
      { status: 400 },
    );
  }

  const parsed = parseYouTubeUrl(url);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: 400 },
    );
  }

  // Kick off the conversion immediately so the first progress poll has data.
  const job = await createJob(parsed.videoId, format, videoTitle);
  // Tick once so callers get an early state.
  const ticked = (await tickJob(job.id)) ?? job;

  return NextResponse.json({
    ok: true,
    jobId: ticked.id,
    status: ticked.status,
    progress: ticked.progress,
    title: ticked.title,
    format: ticked.format,
    error: ticked.error,
  });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("jobId");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing jobId." },
      { status: 400 },
    );
  }
  const existing = getJob(id);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Job not found or expired." },
      { status: 404 },
    );
  }
  const job = (await tickJob(id)) ?? existing;
  return NextResponse.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    title: job.title,
    format: job.format,
    error: job.error,
    videoId: job.videoId,
  });
}
