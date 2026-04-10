import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseIntentWithMeta, synthesizeRoute } from "@/lib/groq";
import { geocodeNominatim } from "@/lib/nominatim";
import { geocodeTravelEndpointDiagnostics } from "@/lib/photon";
import { getRoute } from "@/lib/osrm";
import { getScheduledFlights } from "@/lib/aviationstack";
import { getWeather } from "@/lib/open-meteo";
import { getTransitFeeds } from "@/lib/transitland";
import { enqueueScraperJob } from "@/lib/scrape-queue";
import {
  type FlightAlternative,
  type ParsedIntent,
  RoutePlan,
  RoutePlanErrorDebug,
  RoutePlanResponse,
  Waypoint,
} from "@/lib/types/route";
import { randomUUID } from "crypto";
import { resolveIataForEndpoint } from "@/lib/iata-resolve";

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

  if (intent.parseFailed && parseMeta.groqApiError) {
    const debug: RoutePlanErrorDebug = {
      stage: "parse",
      zodOk: false,
      groqApiError: parseMeta.groqApiError,
      heuristicUsed: parseMeta.heuristicUsed,
    };
    attachGroqPreview(debug, parseMeta, clientDebug);
    return NextResponse.json(
      {
        error:
          "No pude conectar con el servicio de interpretación (IA). Revisá GROQ_API_KEY en el servidor o intentá de nuevo más tarde.",
        intent,
        debug,
      },
      { status: 503 },
    );
  }

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
      groqApiError: parseMeta.groqApiError,
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

  const photonLang = process.env.PHOTON_LANG;
  /** Varios hits Photon + ranking por ciudad/admin (sin sesgar el destino cerca del origen). */
  const travelPhotonLimit = 12;

  // ── N0: Geocode (Photon primero; Nominatim como respaldo — política ~1 req/s en Nominatim)
  const originDiag = await geocodeTravelEndpointDiagnostics(intent.origin, {
    lang: photonLang,
    limit: travelPhotonLimit,
    role: "origin",
  });
  let originCoord = originDiag.coord;
  let nominatimOriginTried = false;
  if (!originCoord) {
    originCoord = await geocodeNominatim(intent.origin);
    nominatimOriginTried = true;
  }

  const destDiag = await geocodeTravelEndpointDiagnostics(intent.destination, {
    lang: photonLang,
    limit: travelPhotonLimit,
    role: "destination",
    origin: originCoord ?? undefined,
  });
  let destCoord = destDiag.coord;
  let nominatimDestTried = false;
  if (!destCoord) {
    if (nominatimOriginTried) {
      await new Promise((r) => setTimeout(r, 1100));
    }
    destCoord = await geocodeNominatim(intent.destination);
    nominatimDestTried = true;
  }

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
      nominatimOriginTried,
      nominatimDestTried,
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

  const intentWithIata: ParsedIntent = {
    ...intent,
    dep_iata: resolveIataForEndpoint(
      intent.dep_iata,
      intent.origin,
      originCoord.name,
    ),
    arr_iata: resolveIataForEndpoint(
      intent.arr_iata,
      intent.destination,
      destCoord.name,
    ),
  };

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
    transportSegments: routeResult
      ? [{ ...routeResult.segment, geometry: routeResult.polyline }]
      : [],
    weather: weather ?? undefined,
    transitFeeds: transitFeeds,
    parsedIntent: intentWithIata,
  };

  // ── Aviationstack (opcional): vuelos programados si hay IATA en el intent
  let flightAlternatives: FlightAlternative[] | undefined;
  if (
    process.env.AVIATIONSTACK_API_KEY &&
    intentWithIata.dep_iata &&
    intentWithIata.arr_iata
  ) {
    const date =
      intentWithIata.departureDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(intentWithIata.departureDate)
        ? intentWithIata.departureDate
        : undefined;
    const rows = await getScheduledFlights(
      intentWithIata.dep_iata,
      intentWithIata.arr_iata,
      {
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
        origin: intentWithIata.origin,
        destination: intentWithIata.destination,
        departureDate: intentWithIata.departureDate,
        sessionId,
        dep_iata: intentWithIata.dep_iata,
        arr_iata: intentWithIata.arr_iata,
        currency: intentWithIata.currency,
      });
    } catch {
      // N3 failure is non-blocking
    }
  }

  // ── Assemble full plan ──────────────────────────────────────────────────────
  const plan: RoutePlan = {
    id: randomUUID(),
    parsedIntent: intentWithIata,
    origin: originCoord,
    destination: destCoord,
    waypoints,
    transportSegments: routeResult
      ? [{ ...routeResult.segment, geometry: routeResult.polyline }]
      : [],
    weather: weather ?? undefined,
    transitFeeds,
    aiSynthesis,
    flightAlternatives,
    tags: intentWithIata.interests,
    estimatedBudget: { currency: intentWithIata.currency, amount: 0 },
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
