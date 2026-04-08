/**
 * scrape-worker.ts
 * Run with: npm run worker
 * Consumes "scrape-prices" queue and extracts flight/bus prices.
 *
 * In production swap the STUB implementation for a real Crawlee actor.
 * The interface is stable so the rest of the codebase doesn't change.
 */
import { Worker, Job } from "bullmq";
import { ScrapeJobData } from "../lib/scrape-queue";
import {
  RawScrapedPrice,
  validatePrices,
} from "../lib/validation-pipeline";

const REDIS_URL = process.env.REDIS_URL;
const connection = REDIS_URL
  ? (() => {
      const u = new URL(REDIS_URL);
      return {
        host: u.hostname,
        port: Number(u.port) || 6379,
        password: u.password || undefined,
      };
    })()
  : {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    };

// ─── Stub scraper (replace with Crawlee in production) ───────────────────────

async function scrapeFlightPrices(
  _origin: string,
  _destination: string,
  _departureDate?: string,
): Promise<RawScrapedPrice[]> {
  // TODO: replace with real Crawlee/Apify actor
  // Example real implementation:
  //   const crawler = new PlaywrightCrawler({ ... });
  //   await crawler.run(["https://www.google.com/travel/flights?..."]);
  //
  // For demo/dev we return realistic stub data
  await new Promise((r) => setTimeout(r, 1500)); // simulate scraping delay

  return [
    {
      provider: "JetSmart (simulado)",
      price: 58000,
      currency: "ARS",
      mode: "plane",
      departure: new Date(Date.now() + 86400000 * 3).toISOString(),
    },
    {
      provider: "Aerolíneas Argentinas (simulado)",
      price: 95000,
      currency: "ARS",
      mode: "plane",
      departure: new Date(Date.now() + 86400000 * 4).toISOString(),
    },
  ];
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker<ScrapeJobData, RawScrapedPrice[]>(
  "scrape-prices",
  async (job: Job<ScrapeJobData>) => {
    const { origin, destination, departureDate } = job.data;
    console.log(`[worker] Processing job ${job.id}: ${origin} → ${destination}`);

    const raw = await scrapeFlightPrices(origin, destination, departureDate);
    const validated = validatePrices(raw);

    console.log(`[worker] Job ${job.id} done: ${validated.length} prices validated`);
    return validated;
  },
  {
    connection,
    concurrency: 3,
  },
);

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

console.log("[worker] Scrape worker started, waiting for jobs...");
