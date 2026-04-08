import { NamedCoord } from "./types/route";

const BASE = process.env.PHOTON_BASE_URL ?? "https://photon.komoot.io";
const TIMEOUT_MS = 5000;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; city?: string; country?: string };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

export async function geocode(query: string): Promise<NamedCoord | null> {
  const url = `${BASE}/api?q=${encodeURIComponent(query)}&limit=1&lang=es`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const data: PhotonResponse = await res.json();
    if (!data.features.length) return null;
    const f = data.features[0];
    const [lng, lat] = f.geometry.coordinates;
    const name =
      f.properties.name ||
      f.properties.city ||
      f.properties.country ||
      query;
    return { name, lat, lng };
  } catch {
    return null;
  }
}
