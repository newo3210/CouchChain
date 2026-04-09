/**
 * Rutas de conducción: OSRM vía ROUTING_BASE_URL + fallback GraphHopper.
 */
import { NamedCoord } from "./types/route";
import type { TransportSegment } from "./types/route";
import {
  getDrivingRoute,
  getOsrmRoute,
  normalizeRoutingBase,
  type DrivingRouteResult,
} from "./driving-route";

export type OsrmResult = DrivingRouteResult;

export async function getRoute(
  from: NamedCoord,
  to: NamedCoord,
): Promise<OsrmResult | null> {
  return getDrivingRoute(from, to);
}

export async function getMultiStopRoute(
  waypoints: NamedCoord[],
): Promise<{ polyline: [number, number][]; segments: TransportSegment[] } | null> {
  if (waypoints.length < 2) return null;
  const coordStr = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const base = normalizeRoutingBase();
  const url = `${base}/${coordStr}?overview=full&geometries=geojson&steps=false`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0];
    const polyline = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    );
    const segments: TransportSegment[] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const leg = await getDrivingRoute(waypoints[i], waypoints[i + 1]);
      if (leg) segments.push(leg.segment);
    }
    return { polyline, segments };
  } catch {
    return null;
  }
}

export { getOsrmRoute, getDrivingRoute, normalizeRoutingBase } from "./driving-route";
