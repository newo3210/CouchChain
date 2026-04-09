"use client";
import { useEffect, useState } from "react";
import {
  RoutePlan,
  ScrapedFlightQuote,
  TransportSegment,
} from "@/lib/types/route";

const MODE_LABELS: Record<string, string> = {
  car: "Auto / Bus",
  bus: "Bus",
  plane: "Vuelo",
  walk: "A pie",
  bike: "Bici",
  ferry: "Barco",
};

function ViabilityDot({ minutes }: { minutes: number }) {
  if (minutes <= 240) return <span title="Viable" className="w-2.5 h-2.5 rounded-full bg-[#6B8E6B] inline-block" />;
  if (minutes <= 600) return <span title="Tramo largo" className="w-2.5 h-2.5 rounded-full bg-[#C4A35A] inline-block" />;
  return <span title="Tramo muy largo" className="w-2.5 h-2.5 rounded-full bg-[#B85C5C] inline-block" />;
}

function PriceBadge({ seg }: { seg: TransportSegment }) {
  if (!seg.price) return null;
  const { amount, currency, freshness, verifiedAt } = seg.price;
  const label =
    freshness === "pending"
      ? "verificando…"
      : verifiedAt
      ? `${currency} ${amount.toLocaleString("es-AR")}`
      : `${currency} ${amount.toLocaleString("es-AR")}`;

  const color =
    freshness === "live"
      ? "text-[#6B8E6B]"
      : freshness === "pending"
      ? "text-[#C4A35A]"
      : "text-[#8a8a8a]";

  return (
    <span className={`font-mono text-xs ${color}`} title={verifiedAt ?? ""}>
      {label}
    </span>
  );
}

interface Props {
  plan: RoutePlan | null;
  scrapePending?: boolean;
  freshnessLabel?: string;
  /** Al elegir una cotización del scraper se actualiza el segmento principal con ese precio. */
  onSelectScrapedFlight?: (quote: ScrapedFlightQuote) => void;
}

export default function RouteLedger({
  plan,
  scrapePending,
  freshnessLabel,
  onSelectScrapedFlight,
}: Props) {
  const flightQuotes = plan?.scrapedFlightQuotes ?? [];
  const [flightPick, setFlightPick] = useState(0);

  useEffect(() => {
    setFlightPick(0);
  }, [plan?.id, flightQuotes.length]);
  if (!plan) {
    return (
      <div className="p-4 text-sm text-[#8a8a8a] italic">
        El itinerario aparecerá aquí una vez que pidas una ruta al Gatito.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">Itinerario</h3>
        {scrapePending && (
          <span className="text-xs text-[#C4A35A] animate-pulse">
            Buscando precios…
          </span>
        )}
        {!scrapePending && freshnessLabel && (
          <span className="text-xs text-[#6B8E6B]">{freshnessLabel}</span>
        )}
      </div>

      {plan.transportSegments.map((seg, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-lg bg-[#FFFFFF] border border-[#E8E8E8]"
        >
          <ViabilityDot minutes={seg.durationMinutes} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#1a1a1a] truncate">
              {seg.from.name} → {seg.to.name}
            </div>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-[#5c5c5c]">
              <span>{MODE_LABELS[seg.mode] ?? seg.mode}</span>
              <span>·</span>
              <span>{seg.durationMinutes} min</span>
              {seg.distanceKm && (
                <>
                  <span>·</span>
                  <span>{seg.distanceKm} km</span>
                </>
              )}
              {seg.transitProvider && (
                <>
                  <span>·</span>
                  <span>{seg.transitProvider}</span>
                </>
              )}
            </div>
            {seg.price && (
              <div className="mt-1">
                <PriceBadge seg={seg} />
              </div>
            )}
          </div>
        </div>
      ))}

      {plan.weather && (
        <div className="p-3 rounded-lg bg-[#f5f0e8] border border-[#e0d5c0] text-xs text-[#5c5c5c]">
          <span className="font-medium">Clima:</span>{" "}
          {plan.weather.temperatureC}°C, {plan.weather.condition} · {" "}
          Viento {plan.weather.windKmh} km/h
        </div>
      )}

      {plan.transitFeeds.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#1a1a1a]">
            Operadores de transporte ({plan.transitFeeds.length})
          </span>
          <ul className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {plan.transitFeeds.map((f, i) => (
              <li
                key={`${f.operatorName}-${i}`}
                className="flex items-start gap-2 rounded-md border border-[#E8E8E8] bg-[#FAFAFA] px-2 py-1.5 text-xs text-[#5c5c5c]"
              >
                <span className="mt-0.5 text-[#8B7355]" aria-hidden>
                  ◆
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="text-[#1a1a1a]">{f.operatorName}</span>
                  {f.feedUrl && (
                    <a
                      href={
                        f.feedUrl.startsWith("http")
                          ? f.feedUrl
                          : `https://${f.feedUrl}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-[#6B7FA8] hover:underline"
                    >
                      web
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {flightQuotes.length > 0 && (
        <div className="p-3 rounded-lg bg-[#f0f4ec] border border-[#c5d4b8] text-xs space-y-2">
          <span className="font-medium text-[#1a1a1a]">
            Opciones de vuelo (precio)
          </span>
          <p className="text-[#5c5c5c] leading-snug">
            Elegí una fila para fijar precio y operador en el primer tramo del itinerario.
          </p>
          <ul className="space-y-1" role="list">
            {flightQuotes.map((q, i) => (
              <li key={`${q.provider}-${i}-${q.price}`}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-[#dce6d4] bg-white px-2 py-1.5 has-[:checked]:border-[#8B7355] has-[:checked]:bg-[#faf8f4]">
                  <input
                    type="radio"
                    name="scraped-flight-quote"
                    className="mt-1"
                    checked={flightPick === i}
                    onChange={() => {
                      setFlightPick(i);
                      onSelectScrapedFlight?.(q);
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-[#1a1a1a]">
                      {q.provider}
                    </span>
                    <span className="ml-2 font-mono text-[#6B8E6B]">
                      {q.currency} {q.price.toLocaleString("es-AR")}
                    </span>
                    {q.departure && (
                      <span className="block text-[#8a8a8a]">{q.departure}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.flightAlternatives && plan.flightAlternatives.length > 0 && (
        <div className="p-3 rounded-lg bg-[#eef2f7] border border-[#d0d9e6] text-xs space-y-1.5">
          <span className="font-medium text-[#1a1a1a]">
            Vuelos (Aviationstack)
          </span>
          <ul className="space-y-1 text-[#5c5c5c] font-mono leading-relaxed">
            {plan.flightAlternatives.slice(0, 6).map((f, i) => (
              <li key={i}>
                {f.airline ?? "—"}{" "}
                {f.flightNumber && `· ${f.flightNumber}`}
                {f.scheduledDeparture && (
                  <span className="text-[#8a8a8a]">
                    {" "}
                    · {f.scheduledDeparture}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs text-[#8a8a8a] pt-2 border-t border-[#E8E8E8]">
        Presupuesto estimado: {plan.estimatedBudget.currency}{" "}
        {plan.estimatedBudget.amount > 0
          ? plan.estimatedBudget.amount.toLocaleString("es-AR")
          : "calculando…"}
      </div>
    </div>
  );
}
