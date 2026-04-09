/**
 * Stub de Actor Apify — mismo contrato conceptual que workers/scrape-worker (origen/destino/fecha).
 * Sustituir por Crawlee/Playwright cuando definas URLs y selectores reales.
 */
import { Actor } from "apify";

await Actor.main(async () => {
  const input = await Actor.getInput();
  const origin = input?.origin ?? "";
  const destination = input?.destination ?? "";
  const departureDate = input?.departureDate ?? null;
  const sessionId = input?.sessionId ?? null;

  if (!origin || !destination) {
    throw new Error("origin y destination son obligatorios");
  }

  // Datos de ejemplo (mismo espíritu que el stub del worker local)
  await Actor.pushData({
    source: "apify-actor-stub",
    origin,
    destination,
    departureDate,
    sessionId,
    scrapedAt: new Date().toISOString(),
    prices: [
      {
        provider: "Demo Jet (Actor)",
        price: 58000,
        currency: "ARS",
        mode: "plane",
        departure: new Date(Date.now() + 86400000 * 3).toISOString(),
      },
      {
        provider: "Demo Air (Actor)",
        price: 95000,
        currency: "ARS",
        mode: "plane",
        departure: new Date(Date.now() + 86400000 * 4).toISOString(),
      },
    ],
  });
});
