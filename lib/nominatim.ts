import type { NamedCoord } from "./types/route";

const NOMINATIM_TIMEOUT_MS = 8000;

/** User-Agent obligatorio por política de uso: https://operations.osmfoundation.org/policies/nominatim/ */
const NOMINATIM_UA =
  "CouchChain/0.1 (ruta demo; +https://github.com/newo3210/CouchChain)";

/**
 * Geocodificación de respaldo vía Nominatim (OSM).
 * Usar solo si Photon no devolvió coordenadas; respetar límite ~1 req/s.
 */
export async function geocodeNominatim(query: string): Promise<NamedCoord | null> {
  const q = query.trim();
  if (!q) return null;

  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "1",
  });
  const url = `https://nominatim.openstreetmap.org/search?${params}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA },
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      lat?: string;
      lon?: string;
      display_name?: string;
    }[];
    const row = rows[0];
    if (!row?.lat || !row?.lon) return null;
    const lat = parseFloat(row.lat);
    const lng = parseFloat(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      name:
        typeof row.display_name === "string" ? row.display_name : q,
      lat,
      lng,
    };
  } catch {
    return null;
  }
}
