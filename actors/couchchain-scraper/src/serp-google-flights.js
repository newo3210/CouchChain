/**
 * Google Flights vía SerpAPI (mismo contrato conceptual que lib/serpapi + scrape-flights en el monorepo).
 */

const TIMEOUT_MS = 15000;
const SERP_ENDPOINT = "https://serpapi.com/search.json";

function asRecord(v) {
  return v != null && typeof v === "object" ? v : null;
}

export function normalizeOutboundDate(departureDate) {
  if (departureDate && /^\d{4}-\d{2}-\d{2}$/.test(String(departureDate))) {
    return String(departureDate);
  }
  if (departureDate) {
    const parsed = Date.parse(String(departureDate));
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export async function serpApiJson(apiKey, params) {
  if (!apiKey) return null;
  const u = new URL(SERP_ENDPOINT);
  u.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") u.searchParams.set(k, String(v));
  }

  try {
    const res = await fetch(u.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function mapSerpGoogleFlightsToPrices(data, fallbackCurrency) {
  const root = asRecord(data);
  if (!root) return [];

  const params = asRecord(root.search_parameters);
  const currency =
    (params?.currency != null && String(params.currency)) || fallbackCurrency;

  const best = Array.isArray(root.best_flights) ? root.best_flights : [];
  const other = Array.isArray(root.other_flights) ? root.other_flights : [];
  const lists = [...best, ...other];

  const out = [];

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
    const depAir =
      first?.departure_airport != null ? asRecord(first.departure_airport) : null;
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

export async function fetchGoogleFlightsPrices({
  apiKey,
  depIata,
  arrIata,
  outboundDate,
  currency,
  gl,
  hl,
}) {
  const dep = String(depIata).trim().toUpperCase();
  const arr = String(arrIata).trim().toUpperCase();
  if (dep.length !== 3 || arr.length !== 3) return [];

  const params = {
    engine: "google_flights",
    departure_id: dep,
    arrival_id: arr,
    outbound_date: outboundDate,
    type: "2",
    currency: currency || "USD",
    hl: hl || process.env.SERPAPI_HL || "es",
    gl: gl || process.env.SERPAPI_GL || "ar",
  };

  const data = await serpApiJson(apiKey, params);
  if (!data) return [];

  const meta = asRecord(data)?.search_metadata;
  if (meta && meta.status === "Error") return [];

  return mapSerpGoogleFlightsToPrices(data, currency || "USD");
}
