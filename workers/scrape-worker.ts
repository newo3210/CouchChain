/**
 * scrape-worker.ts
 * Run with: npm run worker
 * Consumes "scrape-prices" queue and obtiene precios vía SerpAPI (Google Flights) o stub.
 *
 * Variables: REDIS_URL, SERPAPI_API_KEY (opcional), SCRAPER_FORCE_STUB=true para demo.
 * Lee .env y .env.local si existen (para Upstash / claves en local).
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { Worker, Job } from "bullmq";
import { ScrapeJobData } from "../lib/scrape-queue";
import { fetchFlightPricesForJob } from "../lib/scrape-flights";
import { RawScrapedPrice, validatePrices } from "../lib/validation-pipeline";
import { getBullmqConnection } from "../lib/redis-bullmq";

const root = process.cwd();
const envPath = resolve(root, ".env");
const envLocalPath = resolve(root, ".env.local");
if (existsSync(envPath)) config({ path: envPath });
if (existsSync(envLocalPath)) config({ path: envLocalPath, override: true });

async function scrapeFlightPrices(job: ScrapeJobData): Promise<RawScrapedPrice[]> {
  return fetchFlightPricesForJob({
    origin: job.origin,
    destination: job.destination,
    departureDate: job.departureDate,
    dep_iata: job.dep_iata,
    arr_iata: job.arr_iata,
    currency: job.currency,
  });
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker<ScrapeJobData, RawScrapedPrice[]>(
  "scrape-prices",
  async (job: Job<ScrapeJobData>) => {
    const { origin, destination, dep_iata, arr_iata } = job.data;
    console.log(
      `[worker] Processing job ${job.id}: ${origin} → ${destination}` +
        (dep_iata && arr_iata ? ` (${dep_iata}-${arr_iata})` : ""),
    );

    const raw = await scrapeFlightPrices(job.data);
    const validated = validatePrices(raw);

    console.log(`[worker] Job ${job.id} done: ${validated.length} prices validated`);
    return validated;
  },
  {
    connection: getBullmqConnection(),
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
