import { NamedCoord, TransportSegment } from "./types/route";

const TIMEOUT_MS = 10000;

/** API pública GraphHopper (cloud) u host self-hosted sin /route al final. */
const DEFAULT_BASE =
  process.env.GRAPHHOPPER_BASE_URL ??
  process.env.GRASSHOPPER_BASE_URL ??
  "https://graphhopper.com/api/1";

function apiKey(): string | undefined {
  return (
    process.env.GRAPHHOPPER_API_KEY ||
    process.env.GRASSHOPPER_API_KEY ||
    process.env.GRAPHOPPER_API_KEY
  );
}

interface GHPath {
  distance: number;
  time: number;
  /** Con points_encoded=false suele venir como GeoJSON LineString o Feature. */
  points?:
    | { type?: string; coordinates?: [number, number][]; geometry?: { coordinates?: [number, number][] } }
    | { coordinates?: [number, number][] };
}

interface GHResponse {
  paths?: GHPath[];
  message?: string;
}

export interface DrivingRouteResult {
  durationMinutes: number;
  distanceKm: number;
  polyline: [number, number][];
  segment: TransportSegment;
}

/**
 * Ruta en coche vía GraphHopper (fallback cuando OSRM público no responde).
 */
export async function getGraphHopperRoute(
  from: NamedCoord,
  to: NamedCoord,
  vehicle = "car",
): Promise<DrivingRouteResult | null> {
  const key = apiKey();
  if (!key) return null;

  const base = DEFAULT_BASE.replace(/\/+$/, "");
  const u = new URL(`${base}/route`);
  u.searchParams.set("vehicle", vehicle);
  u.searchParams.set("key", key);
  u.searchParams.set("instructions", "false");
  u.searchParams.set("points_encoded", "false");
  u.searchParams.append("point", `${from.lat},${from.lng}`);
  u.searchParams.append("point", `${to.lat},${to.lng}`);

  try {
    const res = await fetch(u.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data: GHResponse = await res.json();
    const path = data.paths?.[0];
    if (!path) return null;

    const durationMinutes = Math.round(path.time / 1000 / 60);
    const distanceKm = Math.round(path.distance / 100) / 10;
    const raw = path.points;
    let line: [number, number][] = [];
    if (raw && typeof raw === "object") {
      const r = raw as {
        coordinates?: [number, number][];
        geometry?: { coordinates?: [number, number][] };
      };
      if (Array.isArray(r.coordinates)) line = r.coordinates;
      else if (r.geometry?.coordinates) line = r.geometry.coordinates;
    }
    const polyline: [number, number][] = line.map(
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
