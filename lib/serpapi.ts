/**
 * SerpAPI — búsquedas (Google Flights, etc.) para fallback o comparación.
 * Docs: https://serpapi.com/
 *
 * Uso típico: vuelos multimodal cuando scraper local falla.
 * Mantener llamadas solo en servidor.
 */

const TIMEOUT_MS = 15000;

export async function serpApiJson(
  params: Record<string, string>,
): Promise<unknown | null> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return null;

  const u = new URL("https://serpapi.com/search.json");
  u.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }

  try {
    const res = await fetch(u.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
