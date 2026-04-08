import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseIntent, synthesizeRoute } from "@/lib/groq";
import { geocode } from "@/lib/photon";
import { getRoute } from "@/lib/osrm";
import { getWeather } from "@/lib/open-meteo";
import { getTransitFeeds } from "@/lib/transitland";
import { enqueueScraperJob } from "@/lib/scrape-queue";
import { RoutePlan, RoutePlanResponse, Waypoint } from "@/lib/types/route";
import { randomUUID } from "crypto";

const BodySchema = z.object({
  message: z.string().min(1).max(1000),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { message, sessionId = randomUUID() } = parsed.data;

  // ── N0: Parse intent ────────────────────────────────────────────────────────
  const intent = await parseIntent(message);

  // ── N0: Geocode origin and destination (Photon) ─────────────────────────────
  const [originCoord, destCoord] = await Promise.all([
    geocode(intent.origin),
    geocode(intent.destination),
  ]);

  if (!originCoord || !destCoord) {
    return NextResponse.json(
      {
        error: "No pude geolocalizar origen o destino. ¿Podés ser más específico?",
        intent,
      },
      { status: 422 },
    );
  }

  // ── N0: Route (OSRM) ────────────────────────────────────────────────────────
  const routeResult = await getRoute(originCoord, destCoord);

  // ── N1 + N2: Parallel enrichment ────────────────────────────────────────────
  const midpoint = routeResult
    ? {
        lat: (originCoord.lat + destCoord.lat) / 2,
        lng: (originCoord.lng + destCoord.lng) / 2,
      }
    : originCoord;

  const [weather, transitFeeds] = await Promise.all([
    getWeather(midpoint),
    getTransitFeeds(midpoint),
  ]);

  // ── Build waypoints ─────────────────────────────────────────────────────────
  const waypoints: Waypoint[] = [
    { ...originCoord, id: randomUUID(), type: "origin" },
    { ...destCoord, id: randomUUID(), type: "destination" },
  ];

  // ── Assemble partial plan for synthesis ─────────────────────────────────────
  const partialPlan: Partial<RoutePlan> = {
    origin: originCoord,
    destination: destCoord,
    waypoints,
    transportSegments: routeResult ? [routeResult.segment] : [],
    weather: weather ?? undefined,
    transitFeeds: transitFeeds,
    parsedIntent: intent,
  };

  // ── Synthesis (Groq) ────────────────────────────────────────────────────────
  const aiSynthesis = await synthesizeRoute(partialPlan);

  // ── N3: Enqueue scraper job for flight/bus prices (async) ───────────────────
  let scrapeJobId: string | undefined;
  const needsAirPrices =
    !transitFeeds.length ||
    (routeResult && routeResult.distanceKm > 800);

  if (needsAirPrices) {
    try {
      scrapeJobId = await enqueueScraperJob({
        origin: intent.origin,
        destination: intent.destination,
        departureDate: intent.departureDate,
        sessionId,
      });
    } catch {
      // N3 failure is non-blocking
    }
  }

  // ── Assemble full plan ──────────────────────────────────────────────────────
  const plan: RoutePlan = {
    id: randomUUID(),
    parsedIntent: intent,
    origin: originCoord,
    destination: destCoord,
    waypoints,
    transportSegments: routeResult ? [routeResult.segment] : [],
    weather: weather ?? undefined,
    transitFeeds,
    aiSynthesis,
    tags: intent.interests,
    estimatedBudget: { currency: intent.currency, amount: 0 },
    generatedAt: new Date().toISOString(),
    scrapeJob: scrapeJobId
      ? {
          jobId: scrapeJobId,
          status: "queued",
          enqueuedAt: new Date().toISOString(),
        }
      : undefined,
  };

  const response: RoutePlanResponse = {
    plan,
    scrapeJobId,
  };

  return NextResponse.json(response);
}
