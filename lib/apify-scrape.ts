/**
 * Arranque y consulta de runs del Actor CouchChain en Apify (precios SerpAPI en la nube).
 * Docs: https://docs.apify.com/api/v2-new/act-runs-post
 */
import type { RawScrapedPrice } from "./validation-pipeline";

export const APIFY_JOB_PREFIX = "apify:";

export function useApifyForN3(): boolean {
  const token = (process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN)?.trim();
  const actorId = process.env.APIFY_ACTOR_ID?.trim();
  return Boolean(token && actorId);
}

function getToken(): string {
  const t = (process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN)?.trim();
  if (!t) throw new Error("Falta APIFY_API_TOKEN o APIFY_TOKEN");
  return t;
}

function getActorId(): string {
  const id = process.env.APIFY_ACTOR_ID?.trim();
  if (!id) throw new Error("Falta APIFY_ACTOR_ID (ej. usuario~nombre-del-actor)");
  return id;
}

export interface CouchChainActorInput {
  origin: string;
  destination: string;
  departureDate?: string;
  sessionId: string;
  dep_iata?: string;
  arr_iata?: string;
  currency?: string;
}

interface ApifyRunData {
  id: string;
  status: string;
  defaultDatasetId?: string;
  finishedAt?: string | null;
}

function asRunPayload(json: unknown): ApifyRunData | null {
  if (!json || typeof json !== "object") return null;
  const d = (json as { data?: unknown }).data;
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const id = o.id;
  const status = o.status;
  if (typeof id !== "string" || typeof status !== "string") return null;
  return {
    id,
    status,
    defaultDatasetId:
      typeof o.defaultDatasetId === "string" ? o.defaultDatasetId : undefined,
    finishedAt: o.finishedAt != null ? String(o.finishedAt) : null,
  };
}

export async function startActorRun(input: CouchChainActorInput): Promise<string> {
  const token = getToken();
  const actorId = getActorId();
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apify run failed (${res.status}): ${err.slice(0, 500)}`);
  }

  const json: unknown = await res.json();
  const data = asRunPayload(json);
  if (!data?.id) throw new Error("Apify: respuesta sin run id");
  return data.id;
}

export async function getActorRun(runId: string): Promise<ApifyRunData | null> {
  const token = getToken();
  const res = await fetch(
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const json: unknown = await res.json();
  return asRunPayload(json);
}

/** El Actor hace un pushData con un objeto que incluye `prices: RawScrapedPrice[]`. */
export async function fetchRunDatasetPrices(
  datasetId: string,
): Promise<RawScrapedPrice[]> {
  const token = getToken();
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const items: unknown = await res.json();
  if (!Array.isArray(items) || items.length === 0) return [];
  const first = items[0];
  if (!first || typeof first !== "object") return [];
  const prices = (first as { prices?: unknown }).prices;
  if (!Array.isArray(prices)) return [];
  const out: RawScrapedPrice[] = [];
  for (const p of prices) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const provider = o.provider != null ? String(o.provider) : "";
    const price = o.price;
    const currency = o.currency != null ? String(o.currency) : "";
    const mode = "plane";
    if (!provider || typeof price !== "number" || price <= 0 || !currency)
      continue;
    const x: RawScrapedPrice = {
      provider,
      price,
      currency,
      mode,
    };
    if (o.departure != null) x.departure = String(o.departure);
    out.push(x);
  }
  return out;
}

export function apifyStatusToJobState(
  status: string,
): "waiting" | "active" | "completed" | "failed" {
  switch (status) {
    case "SUCCEEDED":
      return "completed";
    case "FAILED":
    case "ABORTED":
    case "TIMED-OUT":
      return "failed";
    case "READY":
    case "RUNNING":
    default:
      return "active";
  }
}
