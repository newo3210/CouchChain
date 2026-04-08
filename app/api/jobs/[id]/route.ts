import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/scrape-queue";
import { freshnessLabel } from "@/lib/validation-pipeline";
import { JobStatusResponse } from "@/lib/types/route";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await getJobStatus(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const statusMap: Record<string, JobStatusResponse["status"]> = {
    waiting: "queued",
    active: "running",
    completed: "done",
    failed: "failed",
    delayed: "queued",
  };

  const result = job.returnvalue ?? undefined;
  const completedAt =
    job.state === "completed"
      ? new Date().toISOString()
      : undefined;

  const response: JobStatusResponse & { freshnessLabel?: string } = {
    jobId: id,
    status: statusMap[job.state] ?? "queued",
    result,
    completedAt,
    freshnessLabel: completedAt ? freshnessLabel(completedAt) : undefined,
  };

  return NextResponse.json(response);
}
