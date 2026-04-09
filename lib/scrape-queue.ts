import { Queue, QueueOptions } from "bullmq";
import { randomUUID } from "crypto";
import {
  APIFY_JOB_PREFIX,
  useApifyForN3,
  startActorRun,
  getActorRun,
  fetchRunDatasetPrices,
  apifyStatusToJobState,
  type CouchChainActorInput,
} from "./apify-scrape";
import type { RawScrapedPrice } from "./validation-pipeline";

export interface ScrapeJobData {
  origin: string;
  destination: string;
  departureDate?: string;
  sessionId: string;
  dep_iata?: string;
  arr_iata?: string;
  currency?: string;
}

const CONNECTION: QueueOptions["connection"] = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  ...(process.env.REDIS_URL
    ? parseRedisUrl(process.env.REDIS_URL)
    : {}),
};

function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
} {
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

function toActorInput(data: ScrapeJobData): CouchChainActorInput {
  return {
    origin: data.origin,
    destination: data.destination,
    departureDate: data.departureDate,
    sessionId: data.sessionId,
    dep_iata: data.dep_iata,
    arr_iata: data.arr_iata,
    currency: data.currency,
  };
}

/** Prioridad: Apify (Actor en la nube) si hay token + actor id; si no, BullMQ + Redis. */
export async function enqueueScraperJob(data: ScrapeJobData): Promise<string> {
  if (useApifyForN3()) {
    const runId = await startActorRun(toActorInput(data));
    return `${APIFY_JOB_PREFIX}${runId}`;
  }

  const jobId = randomUUID();
  const queue = getQueue();
  await queue.add("scrape", data, { jobId });
  return jobId;
}

export type JobStatusResult = {
  jobId: string;
  state: string;
  returnvalue?: RawScrapedPrice[];
  /** ISO cuando el job terminó OK (BullMQ o Apify). */
  completedAt?: string;
};

export async function getJobStatus(
  jobId: string,
): Promise<JobStatusResult | null> {
  if (jobId.startsWith(APIFY_JOB_PREFIX)) {
    const runId = jobId.slice(APIFY_JOB_PREFIX.length);
    try {
      const run = await getActorRun(runId);
      if (!run) return null;
      const state = apifyStatusToJobState(run.status);

      if (state === "completed") {
        const prices = run.defaultDatasetId
          ? await fetchRunDatasetPrices(run.defaultDatasetId)
          : [];
        return {
          jobId,
          state: "completed",
          returnvalue: prices,
          completedAt: run.finishedAt || new Date().toISOString(),
        };
      }

      if (state === "failed") {
        return { jobId, state: "failed" };
      }

      return { jobId, state: run.status === "READY" ? "waiting" : "active" };
    } catch {
      return null;
    }
  }

  const queue = getQueue();
  const job = await queue.getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  const rv = job.returnvalue as RawScrapedPrice[] | undefined;
  const completedAt =
    state === "completed" && job.finishedOn
      ? new Date(job.finishedOn).toISOString()
      : undefined;
  return {
    jobId,
    state,
    returnvalue: rv,
    completedAt,
  };
}
