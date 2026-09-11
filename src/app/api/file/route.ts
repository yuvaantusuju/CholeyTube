import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";
import { streamFromUrl } from "@/lib/converter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "Missing jobId." },
      { status: 400 },
    );
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Job not found or expired." },
      { status: 404 },
    );
  }
  if (job.status !== "ready" || !job.downloadUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: `Your file isn't ready yet (current status: ${job.status}).`,
      },
      { status: 409 },
    );
  }

  try {
    const response = await streamFromUrl(
      job.downloadUrl,
      job.format,
      job.title,
    );
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Couldn't download the file. It may have expired — try again.",
      },
      { status: 502 },
    );
  }
}
