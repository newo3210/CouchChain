import { NamedCoord, TransportSegment } from "./types/route";
import { getGraphHopperRoute } from "./graphhopper";

const TIMEOUT_MS = 8000;

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: { steps: unknown[] }[];
}

interface OsrmResponse {
  code: string;
  routes?: OsrmRoute[];
}

export interface DrivingRouteResult {
  durationMinutes: number;
  distanceKm: number;
  polyline: [number, number][];
  segment: TransportSegment;
}

/**
 * Normaliza ROUTING_BASE_URL: solo prefijo hasta /driving (sin coords tipo lng,lat;lng,lat).
 */
export function normalizeRoutingBase(raw?: string): string {
  const fallback = "https://router.project-osrm.org/route/v1/driving";
  let u = (raw ?? process.env.ROUTING_BASE_URL ?? "").trim();
  if (!u) {
    const legacy = process.env.OSRM_BASE_URL?.trim();
    if (legacy) {
      u = legacy.replace(/\/+$/, "") + "/route/v1/driving";
    } else {
      return fallback;
    }
  }
  if (!/^https?:\/\//i.test(u)) u = `https://${u.replace(/^\/+/, "")}`;
  u = u.replace(/lng\s*,\s*lat\s*;\s*lng\s*,\s*lat/gi, "");
  u = u.replace(/\/+$/, "");
  if (!u.includes("/driving")) {
    const baseHost = u.replace(/\/route\/v1.*$/i, "").replace(/\/+$/, "");
    u = `${baseHost}/route/v1/driving`;
  }
  return u;
}

function buildOsrmUrl(from: NamedCoord, to: NamedCoord): string {
  const base = normalizeRoutingBase();
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  return `${base}/${coords}?overview=full&geometries=geojson&steps=false`;
}

export async function getOsrmRoute(
  from: NamedCoord,
  to: NamedCoord,
): Promise<DrivingRouteResult | null> {
  const url = buildOsrmUrl(from, to);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const data: OsrmResponse = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0];
    const durationMinutes = Math.round(route.duration / 60);
    const distanceKm = Math.round(route.distance / 100) / 10;
    const polyline = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
    const segment: TransportSegment = {
      mode: "car",
      from,
      to,
      durationMinutes,
      distanceKm,
    };
    return { durationMinutes, distanceKm, polyline, segment };
  } catch {
    return null;
  }
}

/**
 * OSRM (ROUTING_BASE_URL) primero; si falla, GraphHopper con API key.
 */
export async function getDrivingRoute(
  from: NamedCoord,
  to: NamedCoord,
): Promise<DrivingRouteResult | null> {
  const osrm = await getOsrmRoute(from, to);
  if (osrm) return osrm;
  return getGraphHopperRoute(from, to);
}
