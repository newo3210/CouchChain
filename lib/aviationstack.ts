/**
 * Aviationstack — vuelos programados / comparación cuando el scraper no cubre la ruta.
 * Docs: https://aviationstack.com/documentation
 */

const BASE = "http://api.aviationstack.com/v1";
const TIMEOUT_MS = 8000;

export interface AviationFlightRow {
  flight_date?: string;
  flight_status?: string;
  departure?: { airport?: string; iata?: string; scheduled?: string };
  arrival?: { airport?: string; iata?: string; scheduled?: string };
  airline?: { name?: string; iata?: string };
  flight?: { iata?: string; number?: string };
}

interface FlightsResponse {
  data?: AviationFlightRow[];
  error?: { info?: string };
}

export async function getScheduledFlights(
  depIata: string,
  arrIata: string,
  options?: { date?: string; limit?: number },
): Promise<AviationFlightRow[]> {
  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) return [];

  const u = new URL(`${BASE}/flights`);
  u.searchParams.set("access_key", key);
  u.searchParams.set("dep_iata", depIata.toUpperCase());
  u.searchParams.set("arr_iata", arrIata.toUpperCase());
  u.searchParams.set("flight_status", "scheduled");
  if (options?.date) u.searchParams.set("flight_date", options.date);
  u.searchParams.set("limit", String(options?.limit ?? 10));

  try {
    const res = await fetch(u.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json: FlightsResponse = await res.json();
    if (json.error?.info) return [];
    return json.data ?? [];
  } catch {
    return [];
  }
}
