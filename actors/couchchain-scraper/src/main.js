/**
 * CouchChain Actor — precios de vuelo reales vía SerpAPI (Google Flights).
 * Secret: SERPAPI_API_KEY en Apify → Settings → Environment / Secrets.
 *
 * Requiere dep_iata + arr_iata (3 letras) en el input para consultar SerpAPI.
 */
import { Actor } from "apify";
import {
  normalizeOutboundDate,
  fetchGoogleFlightsPrices,
} from "./serp-google-flights.js";

function normIata(v) {
  if (v == null || v === "") return undefined;
  const s = String(v).trim().toUpperCase();
  return s.length === 3 ? s : undefined;
}

await Actor.main(async () => {
  const input = await Actor.getInput();
  const origin = input?.origin?.trim() ?? "";
  const destination = input?.destination?.trim() ?? "";
  const departureDate = input?.departureDate ?? null;
  const sessionId = input?.sessionId ?? null;
  const depIata = normIata(input?.dep_iata);
  const arrIata = normIata(input?.arr_iata);
  const currency = input?.currency?.trim() || "USD";

  if (!origin || !destination) {
    throw new Error("origin y destination son obligatorios");
  }

  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  const outboundDate = normalizeOutboundDate(departureDate ?? undefined);

  const baseRow = {
    origin,
    destination,
    departureDate: departureDate ?? null,
    sessionId,
    dep_iata: depIata ?? null,
    arr_iata: arrIata ?? null,
    currency,
    scrapedAt: new Date().toISOString(),
  };

  if (!apiKey) {
    await Actor.pushData({
      ...baseRow,
      source: "error",
      error:
        "Falta SERPAPI_API_KEY. Agregala en el Actor: Settings → Environment / Secrets.",
      prices: [],
    });
    Actor.log.info(
      "SERPAPI_API_KEY no definida; configurá el secret en el Actor.",
    );
    return;
  }

  if (!depIata || !arrIata) {
    await Actor.pushData({
      ...baseRow,
      source: "serpapi-skipped",
      notice:
        "Google Flights (SerpAPI) necesita códigos IATA en dep_iata y arr_iata. Tu backend debe enviarlos junto con origin/destination.",
      prices: [],
    });
    Actor.log.info(
      "Sin dep_iata/arr_iata: no se llama a SerpAPI. Añadí esos campos en el input.",
    );
    return;
  }

  Actor.log.info(
    `SerpAPI Google Flights: ${depIata} → ${arrIata} (${outboundDate}, ${currency})`,
  );

  const prices = await fetchGoogleFlightsPrices({
    apiKey,
    depIata,
    arrIata,
    outboundDate,
    currency,
  });

  if (!prices.length) {
    await Actor.pushData({
      ...baseRow,
      source: "serpapi-google-flights",
      notice:
        "SerpAPI no devolvió vuelos para esta ruta/fecha. Revisá IATA, fecha o cuota API.",
      prices: [],
    });
    return;
  }

  await Actor.pushData({
    ...baseRow,
    source: "serpapi-google-flights",
    prices,
  });
});
