import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { getBullmqConnection } from "./redis-bullmq";

export interface ScrapeJobData {
  origin: string;
  destination: string;
  departureDate?: string;
  sessionId: string;
  /** IATA 3 letras — obligatorias para precios reales vía SerpAPI Google Flights */
  dep_iata?: string;
  arr_iata?: string;
  currency?: string;
}

let _queue: Queue<ScrapeJobData> | null = null;

function getQueue(): Queue<ScrapeJobData> {
  if (!_queue) {
    _queue = new Queue<ScrapeJobData>("scrape-prices", {
      connection: getBullmqConnection(),
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
