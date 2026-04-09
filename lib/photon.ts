import { NamedCoord } from "./types/route";

const TIMEOUT_MS = 5000;

/** GeoJSON FeatureCollection devuelto por Photon (Komoot u instancias compatibles). */
export interface PhotonGeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    name?: string;
    city?: string;
    country?: string;
    state?: string;
    postcode?: string;
    [key: string]: unknown;
  };
}

export interface PhotonGeoJsonResponse {
  type: "FeatureCollection";
  features: PhotonGeoJsonFeature[];
}

export interface GeocodeOptions {
  /** Sesgo geográfico (Photon: lat / lon en query string). */
  bias?: { lat: number; lng: number };
  /** Límite de resultados (sobrescribe PHOTON_LIMIT del env si se pasa). */
  limit?: number;
  /** Idioma (sobrescribe PHOTON_LANG del env si se pasa). */
  lang?: string;
}

function ensureHttps(url: string): string {
  const t = url.trim();
  if (!t) return "https://photon.komoot.io/api/?q=";
  if (!/^https?:\/\//i.test(t)) return `https://${t.replace(/^\/+/, "")}`;
  return t;
}

/**
 * Construye la URL de búsqueda Photon:
 * - Si PHOTON_BASE_URL termina en `?q=` o contiene `q=` sin valor, se concatena el texto escapado.
 * - Si es una base sin query, se añade `?q=...`.
 * - Parámetros opcionales: `&lat=&lon=` (sesgo), `&limit=`, `&lang=`.
 */
export function buildPhotonSearchUrl(
  query: string,
  options: GeocodeOptions = {},
): string {
  let base = ensureHttps(
    process.env.PHOTON_BASE_URL ?? "https://photon.komoot.io/api/?q=",
  );

  const limit =
    options.limit ??
    (process.env.PHOTON_LIMIT ? Number(process.env.PHOTON_LIMIT) : 5);
  const lang =
    options.lang ?? process.env.PHOTON_LANG ?? "es";

  const q = encodeURIComponent(query.trim());
  let url: string;

  if (/\?q=\s*$/i.test(base) || /[?&]q=\s*$/i.test(base)) {
    url = `${base}${q}`;
  } else if (base.includes("?")) {
    url = `${base}&q=${q}`;
  } else {
    url = `${base}?q=${q}`;
  }

  const params = new URLSearchParams();
  if (options.bias) {
    params.set("lat", String(options.bias.lat));
    params.set("lon", String(options.bias.lng));
  }
  if (Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(Math.min(limit, 50)));
  }
  if (lang) params.set("lang", lang);

  const suffix = params.toString();
  if (suffix) url += (url.includes("?") ? "&" : "?") + suffix;

  return url;
}

function firstFeatureToNamedCoord(
  data: PhotonGeoJsonResponse,
  fallbackQuery: string,
): NamedCoord | null {
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    return null;
  }
  const f = data.features[0];
  if (!f?.geometry?.coordinates) return null;
  const [lng, lat] = f.geometry.coordinates;
  const props = f.properties ?? {};
  const name =
    (typeof props.name === "string" && props.name) ||
    (typeof props.city === "string" && props.city) ||
    (typeof props.country === "string" && props.country) ||
    fallbackQuery;
  return { name, lat, lng };
}

/**
 * Geocodifica usando Photon. Respuesta esperada: GeoJSON FeatureCollection.
 */
export async function geocode(
  query: string,
  options: GeocodeOptions = {},
): Promise<NamedCoord | null> {
  const url = buildPhotonSearchUrl(query, { ...options, limit: options.limit ?? 1 });
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json()) as PhotonGeoJsonResponse;
    return firstFeatureToNamedCoord(data, query);
  } catch {
    return null;
  }
}

/**
 * Todas las características devueltas (útil para UI de desambiguación).
 */
export async function geocodeAll(
  query: string,
  options: GeocodeOptions = {},
): Promise<PhotonGeoJsonFeature[]> {
  const url = buildPhotonSearchUrl(query, options);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = (await res.json()) as PhotonGeoJsonResponse;
    if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      return [];
    }
    return data.features;
  } catch {
    return [];
  }
}
