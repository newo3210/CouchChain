import { Coordinates, TransportSegment, NamedCoord } from "./types/route";

const BASE =
  process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
const TIMEOUT_MS = 8000;

interface OsrmRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: { coordinates: [number, number][] };
  legs: { steps: unknown[] }[];
}

interface OsrmResponse {
  code: string;
  routes?: OsrmRoute[];
}

export interface OsrmResult {
  durationMinutes: number;
  distanceKm: number;
  polyline: [number, number][]; // [lat, lng] pairs for Leaflet
  segment: TransportSegment;
}

export async function getRoute(
  from: NamedCoord,
  to: NamedCoord,
): Promise<OsrmResult | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
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

export async function getMultiStopRoute(
  waypoints: NamedCoord[],
): Promise<{ polyline: [number, number][]; segments: TransportSegment[] } | null> {
  if (waypoints.length < 2) return null;
  const coordStr = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url = `${BASE}/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const data: OsrmResponse = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0];
    const polyline = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
    // Build segments for each leg pair
    const segments: TransportSegment[] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const result = await getRoute(waypoints[i], waypoints[i + 1]);
      if (result) segments.push(result.segment);
    }
    return { polyline, segments };
  } catch {
    return null;
  }
}
