/**
 * N3 — precios de vuelo “reales” vía SerpAPI (engine=google_flights).
 * Alineado con docs: SerpAPI como vía estable sin Playwright propio.
 * Requiere códigos IATA de aeropuerto (3 letras) en origen/destino del viaje.
 */
import { serpApiJson } from "./serpapi";
import type { RawScrapedPrice } from "./validation-pipeline";

export interface ScrapeFlightQuery {
  depIata: string;
  arrIata: string;
  /** ISO YYYY-MM-DD para SerpAPI outbound_date */
  outboundDate: string;
  currency: string;
  gl?: string;
  hl?: string;
}

function normalizeOutboundDate(departureDate?: string): string {
  if (departureDate && /^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
    return departureDate;
  }
  const d = new Date();
  if (departureDate) {
    const parsed = Date.parse(departureDate);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** Convierte best_flights / other_flights de SerpAPI a RawScrapedPrice. */
export function mapSerpGoogleFlightsToPrices(
  data: unknown,
  fallbackCurrency: string,
): RawScrapedPrice[] {
  const root = asRecord(data);
  if (!root) return [];

  const params = asRecord(root.search_parameters);
  const currency =
    (params?.currency != null && String(params.currency)) || fallbackCurrency;

  const best = Array.isArray(root.best_flights) ? root.best_flights : [];
  const other = Array.isArray(root.other_flights) ? root.other_flights : [];
  const lists = [...best, ...other];

  const out: RawScrapedPrice[] = [];

  for (const item of lists) {
    const f = asRecord(item);
    if (!f) continue;
    const price = f.price;
    if (typeof price !== "number" || price <= 0) continue;

    const legs = Array.isArray(f.flights) ? f.flights : [];
    const first = asRecord(legs[0]);
    const airline = first?.airline != null ? String(first.airline) : "Aerolínea";
    const flightNumber =
      first?.flight_number != null ? String(first.flight_number).trim() : "";
    const depAir = first?.departure_airport != null ? asRecord(first.departure_airport) : null;
    const depTime = depAir?.time != null ? String(depAir.time) : undefined;

    out.push({
      provider: flightNumber ? `${airline} ${flightNumber}` : airline,
      price,
      currency: currency || fallbackCurrency,
      mode: "plane",
      departure: depTime,
    });
  }

  return out;
}

export async function fetchGoogleFlightsSerpApi(
  q: ScrapeFlightQuery,
): Promise<RawScrapedPrice[]> {
  const dep = q.depIata.trim().toUpperCase();
  const arr = q.arrIata.trim().toUpperCase();
  if (dep.length !== 3 || arr.length !== 3) return [];

  const params: Record<string, string> = {
    engine: "google_flights",
    departure_id: dep,
    arrival_id: arr,
    outbound_date: q.outboundDate,
    type: "2",
    currency: q.currency || "USD",
    hl: q.hl ?? process.env.SERPAPI_HL ?? "es",
    gl: q.gl ?? process.env.SERPAPI_GL ?? "ar",
  };

  const data = await serpApiJson(params);
  if (!data) return [];

  const meta = asRecord(data)?.search_metadata as Record<string, unknown> | undefined;
  if (meta && meta.status === "Error") return [];

  return mapSerpGoogleFlightsToPrices(data, q.currency || "USD");
}

export async function fetchFlightPricesForJob(input: {
  origin: string;
  destination: string;
  departureDate?: string;
  dep_iata?: string;
  arr_iata?: string;
  currency?: string;
}): Promise<RawScrapedPrice[]> {
  const forceStub = process.env.SCRAPER_FORCE_STUB === "true";
  const key = process.env.SERPAPI_API_KEY;

  if (!forceStub && key && input.dep_iata && input.arr_iata) {
    const raw = await fetchGoogleFlightsSerpApi({
      depIata: input.dep_iata,
      arrIata: input.arr_iata,
      outboundDate: normalizeOutboundDate(input.departureDate),
      currency: input.currency || "USD",
    });
    if (raw.length) return raw;
    console.warn("[scrape] SerpAPI Google Flights devolvió 0 resultados (revisa fechas IATA).");
  } else if (!forceStub && key && (!input.dep_iata || !input.arr_iata)) {
    console.warn(
      "[scrape] Hay SERPAPI_API_KEY pero el intent no trae dep_iata/arr_iata. Decile al usuario cosas como «de ROS a BRC» o «salgo de EZE, llego a GIG».",
    );
  }

  return fetchStubFlightPrices();
}

async function fetchStubFlightPrices(): Promise<RawScrapedPrice[]> {
  await new Promise((r) => setTimeout(r, 800));
  return [
    {
      provider: "Demo Jet (stub — configurá SERPAPI + IATA)",
      price: 58000,
      currency: "ARS",
      mode: "plane",
      departure: new Date(Date.now() + 86400000 * 3).toISOString(),
    },
    {
      provider: "Demo Air (stub)",
      price: 95000,
      currency: "ARS",
      mode: "plane",
      departure: new Date(Date.now() + 86400000 * 4).toISOString(),
    },
  ];
}
