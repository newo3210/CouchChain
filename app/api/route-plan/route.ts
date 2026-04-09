import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseIntentWithMeta, synthesizeRoute } from "@/lib/groq";
import { geocodeDiagnostics } from "@/lib/photon";
import { getRoute } from "@/lib/osrm";
import { getScheduledFlights } from "@/lib/aviationstack";
import type { FlightAlternative } from "@/lib/types/route";
import { getWeather } from "@/lib/open-meteo";
import { getTransitFeeds } from "@/lib/transitland";
import { enqueueScraperJob } from "@/lib/scrape-queue";
import {
  RoutePlan,
  RoutePlanErrorDebug,
  RoutePlanResponse,
  Waypoint,
} from "@/lib/types/route";
import { randomUUID } from "crypto";

const BodySchema = z.object({
  message: z.string().min(1).max(1000),
  sessionId: z.string().optional(),
  /** Si es true, la respuesta de error incluye detalles extra (p. ej. Vista previa Groq). */
  debug: z.boolean().optional(),
});

function attachGroqPreview(
  debug: RoutePlanErrorDebug,
  meta: { groqRawPreview: string } | undefined,
  clientWantsDebug: boolean,
) {
  const blocked = process.env.ROUTE_PLAN_HIDE_GROQ_PREVIEW === "true";
  if (!blocked && clientWantsDebug && meta) {
    debug.groqRawPreview = meta.groqRawPreview;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const {
    message,
    sessionId = randomUUID(),
    debug: clientDebug = false,
  } = parsed.data;

  // ── N0: Parse intent ────────────────────────────────────────────────────────
  const { intent, meta: parseMeta } = await parseIntentWithMeta(message);

  if (
    intent.parseFailed ||
    !intent.origin.trim() ||
    !intent.destination.trim()
  ) {
    const debug: RoutePlanErrorDebug = {
      stage: "parse",
      zodOk: parseMeta.zodOk,
      heuristicUsed: parseMeta.heuristicUsed,
      zodIssueSummaries: parseMeta.zodIssueSummaries,
    };
    attachGroqPreview(debug, parseMeta, clientDebug);
    return NextResponse.json(
      {
        error:
          "No entendí bien de dónde salís y a dónde vas. Probá algo como: «de Palermo a Mendoza» o «desde Córdoba a Rosario».",
        intent,
        debug,
      },
      { status: 422 },
    );
  }

  const photonLimit = process.env.PHOTON_LIMIT
    ? Number(process.env.PHOTON_LIMIT)
    : undefined;
  const photonLang = process.env.PHOTON_LANG;

  // ── N0: Geocode (Photon / GeoJSON). Destino con sesgo cerca del origen si existe.
  const originDiag = await geocodeDiagnostics(intent.origin);
  const destDiag = await geocodeDiagnostics(intent.destination, {
    bias: originDiag.coord
      ? { lat: originDiag.coord.lat, lng: originDiag.coord.lng }
      : undefined,
    lang: photonLang,
    limit: photonLimit,
  });

  const originCoord = originDiag.coord;
  const destCoord = destDiag.coord;

  if (!originCoord || !destCoord) {
    const debug: RoutePlanErrorDebug = {
      stage: "geocode",
      zodOk: parseMeta.zodOk,
      originQuery: intent.origin,
      destQuery: intent.destination,
      originGeocoded: !!originCoord,
      destGeocoded: !!destCoord,
      originPhotonStatus: originDiag.httpStatus,
      destPhotonStatus: destDiag.httpStatus,
      originFeatureCount: originDiag.featureCount,
      destFeatureCount: destDiag.featureCount,
      heuristicUsed: parseMeta.heuristicUsed,
    };
    attachGroqPreview(debug, parseMeta, clientDebug);
    return NextResponse.json(
      {
        error: "No pude geolocalizar origen o destino. ¿Podés ser más específico?",
        intent,
        debug,
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

  // ── Aviationstack (opcional): vuelos programados si hay IATA en el intent
  let flightAlternatives: FlightAlternative[] | undefined;
  if (
    process.env.AVIATIONSTACK_API_KEY &&
    intent.dep_iata &&
    intent.arr_iata
  ) {
    const date =
      intent.departureDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(intent.departureDate)
        ? intent.departureDate
        : undefined;
    const rows = await getScheduledFlights(intent.dep_iata, intent.arr_iata, {
      date,
      limit: 8,
    });
    if (rows.length) {
      flightAlternatives = rows.map((r) => ({
        source: "aviationstack" as const,
        airline: r.airline?.name,
        flightNumber:
          r.flight?.iata != null
            ? String(r.flight.iata)
            : r.flight?.number != null
              ? String(r.flight.number)
              : undefined,
        departureAirport: r.departure?.airport,
        arrivalAirport: r.arrival?.airport,
        scheduledDeparture: r.departure?.scheduled,
      }));
    }
  }

  // ── Synthesis (Groq) ────────────────────────────────────────────────────────
  const aiSynthesis = await synthesizeRoute({
    ...partialPlan,
    flightAlternatives,
  });

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
        dep_iata: intent.dep_iata,
        arr_iata: intent.arr_iata,
        currency: intent.currency,
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
    flightAlternatives,
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
