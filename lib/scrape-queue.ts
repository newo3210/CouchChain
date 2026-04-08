import { Queue, QueueOptions } from "bullmq";
import { randomUUID } from "crypto";

export interface ScrapeJobData {
  origin: string;
  destination: string;
  departureDate?: string;
  sessionId: string;
}

const CONNECTION: QueueOptions["connection"] = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  // If REDIS_URL is set, parse it
  ...(process.env.REDIS_URL
    ? parseRedisUrl(process.env.REDIS_URL)
    : {}),
};

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

let _queue: Queue<ScrapeJobData> | null = null;

function getQueue(): Queue<ScrapeJobData> {
  if (!_queue) {
    _queue = new Queue<ScrapeJobData>("scrape-prices", {
      connection: CONNECTION,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return _queue;
}

export async function enqueueScraperJob(data: ScrapeJobData): Promise<string> {
  const jobId = randomUUID();
  const queue = getQueue();
  await queue.add("scrape", data, { jobId });
  return jobId;
}

export async function getJobStatus(jobId: string) {
  const queue = getQueue();
  const job = await queue.getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  return { jobId, state, returnvalue: job.returnvalue };
}
