import { TransportSegment } from "./types/route";

const MAX_AGE_MS = 30 * 60 * 1000; // 30 min freshness window

export interface RawScrapedPrice {
  provider: string;
  price: number;
  currency: string;
  departure?: string;
  mode: TransportSegment["mode"];
}

export function validatePrices(
  raw: RawScrapedPrice[],
): RawScrapedPrice[] {
  if (!raw.length) return [];

  // 1. Remove entries with non-positive prices
  const valid = raw.filter((p) => p.price > 0 && p.currency.length > 0);

  // 2. Outlier detection: remove prices > 3× the median
  if (valid.length >= 3) {
    const sorted = [...valid].sort((a, b) => a.price - b.price);
    const median = sorted[Math.floor(sorted.length / 2)].price;
    return sorted.filter((p) => p.price <= median * 3);
  }

  return valid;
}

export function normalizeToPricedSegment(
  base: TransportSegment,
  rawPrices: RawScrapedPrice[],
  scrapedAt: Date = new Date(),
): TransportSegment {
  const validated = validatePrices(rawPrices);
  if (!validated.length) return base;

  // Pick the cheapest validated price
  const cheapest = validated.reduce((a, b) => (a.price < b.price ? a : b));
  const ageMs = Date.now() - scrapedAt.getTime();
  type PriceObj = NonNullable<TransportSegment["price"]>;
  const freshness: PriceObj["freshness"] =
    ageMs < MAX_AGE_MS ? "live" : "stale";

  return {
    ...base,
    mode: cheapest.mode,
    transitProvider: cheapest.provider,
    price: {
      amount: cheapest.price,
      currency: cheapest.currency,
      source: "scraper",
      freshness,
      verifiedAt: scrapedAt.toISOString(),
    },
  };
}

export function freshnessLabel(verifiedAt: string): string {
  const diff = Math.floor((Date.now() - new Date(verifiedAt).getTime()) / 60000);
  if (diff < 1) return "verificado ahora";
  if (diff === 1) return "verificado hace 1 min";
  if (diff < 60) return `verificado hace ${diff} min`;
  return "verificado hace más de 1 hora";
}
