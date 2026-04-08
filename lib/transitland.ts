import { Coordinates, TransitFeed } from "./types/route";

const BASE = "https://transit.land/api/v2/rest";
const TIMEOUT_MS = 8000;

interface TLOperator {
  name: string;
  website?: string;
  feeds?: { id: string }[];
}

interface TLResponse {
  operators?: TLOperator[];
}

export async function getTransitFeeds(
  center: Coordinates,
  radiusKm = 100,
): Promise<TransitFeed[]> {
  const apiKey = process.env.TRANSITLAND_API_KEY;
  const headers: HeadersInit = apiKey ? { apikey: apiKey } : {};

  const radiusM = radiusKm * 1000;
  const url =
    `${BASE}/operators?lon=${center.lng}&lat=${center.lat}` +
    `&radius=${radiusM}&per_page=10`;

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data: TLResponse = await res.json();
    return (data.operators ?? []).map((op) => ({
      operatorName: op.name,
      feedUrl: op.website,
      coverage: `Radio ${radiusKm}km`,
    }));
  } catch {
    return [];
  }
}
