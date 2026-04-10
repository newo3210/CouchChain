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

/** Komoot público solo acepta estos valores; `es` u otros → 400 y falla toda la geocodificación. */
const PHOTON_KOMOOT_LANGS = new Set(["default", "de", "en", "fr"]);

export function normalizePhotonLang(lang: string | undefined): string {
  const t = (lang ?? "").trim().toLowerCase();
  if (PHOTON_KOMOOT_LANGS.has(t)) return t;
  return "default";
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
  const lang = normalizePhotonLang(
    options.lang ?? process.env.PHOTON_LANG ?? "default",
  );

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

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLon = toR(b.lng - a.lng);
  const la = toR(a.lat);
  const lb = toR(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function featureToNamedCoordSingle(
  f: PhotonGeoJsonFeature,
  fallbackQuery: string,
): NamedCoord | null {
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
 * Elige el hit de Photon más apto para viajes entre ciudades (evita calles
 * homónimas cerca del origen cuando el destino es otra ciudad o país).
 */
export function pickBestTravelFeature(
  features: PhotonGeoJsonFeature[],
  query: string,
  origin: NamedCoord | undefined,
  role: "origin" | "destination",
): PhotonGeoJsonFeature | null {
  if (!features.length) return null;
  const qNorm = query.split(",")[0].trim().toLowerCase();

  const scored = features.map((f, idx) => {
    const p = f.properties ?? {};
    let score = 0;
    const name = typeof p.name === "string" ? p.name.toLowerCase() : "";
    const osmKey = String(p.osm_key ?? "").toLowerCase();
    const osmVal = String(p.osm_value ?? "").toLowerCase();
    const ptype = String((p as { type?: string }).type ?? "").toLowerCase();

    if (
      osmKey === "place" &&
      ["city", "town", "village", "state", "country", "region"].includes(
        osmVal,
      )
    ) {
      score += 120;
    }
    if (osmKey === "boundary" && osmVal === "administrative") score += 100;
    if (ptype === "city" || ptype === "administrative") score += 90;
    if (osmKey === "highway") score -= 85;
    if (osmKey === "place" && osmVal === "suburb") score += 35;
    if (osmKey === "place" && osmVal === "neighbourhood") score += 20;

    if (
      name &&
      (name === qNorm || qNorm.includes(name) || name.includes(qNorm))
    ) {
      score += 55;
    }

    if (origin?.lat != null && origin.lng != null && f.geometry?.coordinates) {
      const [lng, lat] = f.geometry.coordinates;
      const distKm = haversineKm(origin, { lat, lng });
      if (role === "destination" && distKm > 75) {
        score += Math.min(55, Math.max(0, Math.log10(distKm / 75) * 38));
      }
    }

    score -= idx * 1.5;
    return { f, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.f ?? null;
}

/**
 * Geocodificación para extremos de ruta de viaje: sin sesgo geográfico,
 * varios candidatos y ranking por tipo OSM (ciudad > calle) y lejanía al origen en destino.
 */
export async function geocodeTravelEndpointDiagnostics(
  query: string,
  options: GeocodeOptions & {
    origin?: NamedCoord;
    role: "origin" | "destination";
  },
): Promise<GeocodeDiagnostics> {
  const envLim = process.env.PHOTON_LIMIT ? Number(process.env.PHOTON_LIMIT) : 12;
  const limit = Math.min(50, Math.max(8, options.limit ?? envLim));
  const { origin, role, bias: _b, ...rest } = options;
  const url = buildPhotonSearchUrl(query.trim(), {
    ...rest,
    limit,
    bias: undefined,
  });
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return { coord: null, httpStatus: res.status, featureCount: 0 };
    }
    const data = (await res.json()) as PhotonGeoJsonResponse;
    const features =
      data.type === "FeatureCollection" && Array.isArray(data.features)
        ? data.features
        : [];
    const best =
      pickBestTravelFeature(features, query, origin, role) ?? features[0];
    const coord = best ? featureToNamedCoordSingle(best, query) : null;
    return {
      coord,
      httpStatus: res.status,
      featureCount: features.length,
    };
  } catch {
    return { coord: null, httpStatus: "network", featureCount: 0 };
  }
}

export type GeocodeDiagnostics = {
  coord: NamedCoord | null;
  httpStatus: number | "network";
  featureCount: number;
};

/**
 * Geocodifica usando Photon y expone estado HTTP y cantidad de features (para depuración en UI/API).
 */
export async function geocodeDiagnostics(
  query: string,
  options: GeocodeOptions = {},
): Promise<GeocodeDiagnostics> {
  const url = buildPhotonSearchUrl(query, { ...options, limit: options.limit ?? 1 });
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return { coord: null, httpStatus: res.status, featureCount: 0 };
    }
    const data = (await res.json()) as PhotonGeoJsonResponse;
    const coord = firstFeatureToNamedCoord(data, query);
    return {
      coord,
      httpStatus: res.status,
      featureCount: data.features?.length ?? 0,
    };
  } catch {
    return { coord: null, httpStatus: "network", featureCount: 0 };
  }
}

/**
 * Geocodifica usando Photon. Respuesta esperada: GeoJSON FeatureCollection.
 */
export async function geocode(
  query: string,
  options: GeocodeOptions = {},
): Promise<NamedCoord | null> {
  const d = await geocodeDiagnostics(query, options);
  return d.coord;
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
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
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
