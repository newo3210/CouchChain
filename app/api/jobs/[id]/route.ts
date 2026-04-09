import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/scrape-queue";
import { freshnessLabel } from "@/lib/validation-pipeline";
import { JobStatusResponse } from "@/lib/types/route";

const STATUS_MAP: Record<string, JobStatusResponse["status"]> = {
  waiting: "queued",
  delayed: "queued",
  active: "running",
  completed: "done",
  failed: "failed",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await getJobStatus(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const mapped = STATUS_MAP[job.state] ?? "queued";
  const result = job.returnvalue ?? undefined;
  const completedAt = job.completedAt;

  const response: JobStatusResponse & { freshnessLabel?: string } = {
    jobId: id,
    status: mapped,
    result,
    completedAt,
    freshnessLabel: completedAt ? freshnessLabel(completedAt) : undefined,
  };

  return NextResponse.json(response);
}
