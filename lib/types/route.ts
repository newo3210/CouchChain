export interface Coordinates {
  lat: number;
  lng: number;
}

export interface NamedCoord extends Coordinates {
  name: string;
}

export type TransportMode = "car" | "bus" | "plane" | "walk" | "bike" | "ferry";
export type PriceSource = "osrm" | "transitland" | "open-meteo" | "scraper" | "manual";
export type PriceFreshness = "live" | "cached" | "stale" | "pending";

export interface TransportSegment {
  mode: TransportMode;
  from: NamedCoord;
  to: NamedCoord;
  durationMinutes: number;
  distanceKm?: number;
  price?: {
    amount: number;
    currency: string;
    source: PriceSource;
    freshness: PriceFreshness;
    verifiedAt?: string; // ISO-8601
  };
  transitProvider?: string; // e.g. "Andesmar", "JetSmart"
  departureTime?: string;   // ISO-8601
}

export interface Waypoint extends NamedCoord {
  id: string;
  type: "origin" | "destination" | "stop";
  notes?: string;
  hostAddress?: string; // wallet address if it's a registered host
  photos?: string[];    // ipfs:// or https://
  placeId?: string;     // external place reference
}

export interface Weather {
  temperatureC: number;
  condition: string;
  precipitationMm: number;
  windKmh: number;
  fetchedAt: string;
}

export interface TransitFeed {
  operatorName: string;
  feedUrl?: string;
  coverage: string; // e.g. "Bariloche - Esquel"
}

/** Cotizaciones de vuelo devueltas por el scraper (SerpAPI / worker), seleccionables en UI. */
export interface ScrapedFlightQuote {
  provider: string;
  price: number;
  currency: string;
  departure?: string;
}

export interface ScrapeJob {
  jobId: string;
  status: "queued" | "running" | "done" | "failed";
  enqueuedAt: string;
  completedAt?: string;
  result?: TransportSegment[];
}

/** Opciones de vuelo vía Aviationstack (cuando hay IATA en el intent). */
export interface FlightAlternative {
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  scheduledDeparture?: string;
  source: "aviationstack";
}

export interface ParsedIntent {
  origin: string;
  destination: string;
  budget: "low" | "medium" | "high" | null;
  currency: string;
  interests: string[];
  departureDate?: string; // ISO-8601 or partial like "next-week"
  durationDays?: number;
  /** IATA opcionales si el usuario los menciona (p. ej. BCN, MAD). */
  dep_iata?: string;
  arr_iata?: string;
  rawQuery: string;
  /**
   * true si el JSON del modelo no validó y no hubo patrón heurístico (de/hacia X…).
   * El API no debe intentar geocodificar cadenas vacías o placeholders inútiles.
   */
  parseFailed?: boolean;
}

export interface RoutePlan {
  id: string; // local uuid before mint
  parsedIntent: ParsedIntent;
  origin: NamedCoord;
  destination: NamedCoord;
  waypoints: Waypoint[];
  transportSegments: TransportSegment[];
  weather?: Weather;
  transitFeeds: TransitFeed[];
  scrapeJob?: ScrapeJob;
  /** Ofertas de vuelo del job N3 (varias filas para elegir en el itinerario). */
  scrapedFlightQuotes?: ScrapedFlightQuote[];
  /** Comparación / fallback de vuelos (Aviationstack u otras fuentes). */
  flightAlternatives?: FlightAlternative[];
  aiSynthesis: string;
  tags: string[];
  estimatedBudget: {
    currency: string;
    amount: number;
    breakdown?: Record<string, number>;
  };
  generatedAt: string; // ISO-8601
}

// Shape persisted to IPFS (version 1.0 per Blueprint)
export interface RouteIpfsPayload {
  version: "1.0";
  created_at: string;
  creator: string; // wallet address
  route_data: {
    origin: NamedCoord;
    destination: NamedCoord;
    waypoints: Waypoint[];
    transport_segments: TransportSegment[];
    estimated_budget: { currency: string; amount: number };
  };
  metadata: {
    tags: string[];
    photos: string[];
    ai_synthesis: string;
    weather?: Weather;
  };
}

export interface TrustStamp {
  tokenId: bigint;
  routeId: bigint;
  traveler: string;
  host: string;
  timestamp: bigint;
  geohash: string; // approximate geohash; precise location never stored
  commentIpfsCid?: string;
}

// API response shapes
export interface RoutePlanResponse {
  plan: RoutePlan;
  scrapeJobId?: string; // present if N3 was enqueued
}

/** Incluido en respuestas 4xx/5xx de POST /api/route-plan cuando el cliente pide debug o siempre (metadatos no sensibles). */
export interface RoutePlanErrorDebug {
  stage: "parse" | "geocode";
  /** true si Zod validó el JSON del modelo (puede haberse enriquecido con heurística si el modelo falló). */
  zodOk: boolean;
  /** Origen/destino ya normalizados que se intentaron geocodificar. */
  originQuery?: string;
  destQuery?: string;
  originGeocoded?: boolean;
  destGeocoded?: boolean;
  originPhotonStatus?: number | string;
  destPhotonStatus?: number | string;
  originFeatureCount?: number;
  destFeatureCount?: number;
  /** Presente si el cliente envió debug: true */
  groqRawPreview?: string;
  zodIssueSummaries?: string[];
  heuristicUsed?: boolean;
  /** Error al llamar a Groq (clave, red, cuota). */
  groqApiError?: string;
  /** Tras Photon vacío, se llamó a Nominatim para esa pata. */
  nominatimOriginTried?: boolean;
  nominatimDestTried?: boolean;
}

/** Filas devueltas por el job N3 (BullMQ o Apify), no segmentos de ruta OSRM. */
export interface ScrapeJobPriceRow {
  provider: string;
  price: number;
  currency: string;
  departure?: string;
  mode?: TransportMode;
}

export interface JobStatusResponse {
  jobId: string;
  status: ScrapeJob["status"];
  result?: ScrapeJobPriceRow[];
  completedAt?: string;
}
