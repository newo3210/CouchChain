"use client";
import dynamic from "next/dynamic";
import { useRef, useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { RoutePlan } from "@/lib/types/route";
import Header from "@/components/ui/Header";
import RouteLedger from "@/components/map/RouteLedger";
import MintButton from "@/components/ui/MintButton";
import type { RawScrapedPrice } from "@/lib/validation-pipeline";
import {
  freshnessLabel,
  normalizeToPricedSegment,
  validatePrices,
} from "@/lib/validation-pipeline";
import type { ScrapedFlightQuote } from "@/lib/types/route";

const RouteMap = dynamic(() => import("@/components/map/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[200px] bg-[#E8E8E8] rounded-lg animate-pulse flex items-center justify-center text-[#8a8a8a] text-sm">
      Cargando mapa…
    </div>
  ),
});

const GatitoAssistant = dynamic(
  () => import("@/components/gatito/GatitoAssistant"),
  { ssr: false },
);

export default function Home() {
  const { address } = useAccount();
  const mapRef = useRef<HTMLDivElement>(null);

  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [scrapeJobId, setScrapeJobId] = useState<string | undefined>();
  const [scrapePending, setScrapePending] = useState(false);
  const [currentFreshnessLabel, setFreshnessLabel] = useState<string>("");
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!scrapeJobId) return;
    setScrapePending(true);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${scrapeJobId}`);
        const data = await res.json();

        if (data.status === "done") {
          clearInterval(interval);
          setScrapePending(false);
          if (data.completedAt) {
            setFreshnessLabel(freshnessLabel(data.completedAt));
          }
          const raw = data.result as RawScrapedPrice[] | undefined;
          if (raw?.length) {
            const validated = validatePrices(raw);
            const doneAt = data.completedAt
              ? new Date(data.completedAt)
              : new Date();
            setPlan((prev) => {
              if (!prev) return prev;
              const segs = [...prev.transportSegments];
              if (segs.length > 0) {
                segs[0] = normalizeToPricedSegment(segs[0], raw, doneAt);
              }
              const scrapedFlightQuotes: ScrapedFlightQuote[] = validated.map(
                (r) => ({
                  provider: r.provider,
                  price: r.price,
                  currency: r.currency,
                  departure: r.departure,
                }),
              );
              return {
                ...prev,
                transportSegments: segs,
                scrapedFlightQuotes,
              };
            });
          }
        } else if (data.status === "failed") {
          clearInterval(interval);
          setScrapePending(false);
        }
      } catch {
        // silently fail polling
      }
    }, 4000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrapeJobId]);

  const handleRoutePlan = useCallback((newPlan: RoutePlan, jobId?: string) => {
    setPlan(newPlan);
    setScrapeJobId(jobId);
    setMintSuccess(null);
    setFreshnessLabel("");
  }, []);

  const handlePickScrapedFlight = useCallback((quote: ScrapedFlightQuote) => {
    setPlan((prev) => {
      if (!prev?.transportSegments.length) return prev;
      const segs = [...prev.transportSegments];
      const head = segs[0];
      segs[0] = {
        ...head,
        mode: "plane",
        transitProvider: quote.provider,
        price: {
          amount: quote.price,
          currency: quote.currency,
          source: "scraper",
          freshness: "live",
          verifiedAt: new Date().toISOString(),
        },
      };
      return { ...prev, transportSegments: segs };
    });
  }, []);

  const handleDismissTransitOperator = useCallback((operatorName: string) => {
    setPlan((prev) =>
      prev
        ? {
            ...prev,
            transitFeeds: prev.transitFeeds.filter(
              (f) => f.operatorName !== operatorName,
            ),
          }
        : prev,
    );
  }, []);

  const handleDismissScrapedFlight = useCallback((index: number) => {
    setPlan((prev) => {
      if (!prev?.scrapedFlightQuotes?.length) return prev;
      const q = [...prev.scrapedFlightQuotes];
      q.splice(index, 1);
      return {
        ...prev,
        scrapedFlightQuotes: q.length ? q : undefined,
      };
    });
  }, []);

  const handleDismissAviationFlight = useCallback((index: number) => {
    setPlan((prev) => {
      if (!prev?.flightAlternatives?.length) return prev;
      const a = [...prev.flightAlternatives];
      a.splice(index, 1);
      return {
        ...prev,
        flightAlternatives: a.length ? a : undefined,
      };
    });
  }, []);

  const handleDismissSegment = useCallback((index: number) => {
    setPlan((prev) => {
      if (!prev || prev.transportSegments.length <= 1) return prev;
      return {
        ...prev,
        transportSegments: prev.transportSegments.filter((_, i) => i !== index),
      };
    });
  }, []);

  const handleWaypointDrag = useCallback(
    async (waypointId: string, lat: number, lng: number) => {
      if (!plan) return;
      const updated = {
        ...plan,
        waypoints: plan.waypoints.map((w) =>
          w.id === waypointId ? { ...w, lat, lng } : w,
        ),
      };
      setPlan(updated);
    },
    [plan],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col min-h-0 w-full max-w-lg mx-auto">
        {/* Fila 1: Gatito + chat */}
        <GatitoAssistant
          onRoutePlan={handleRoutePlan}
          mapContainerRef={mapRef as React.RefObject<HTMLElement>}
          layout="embedded"
        />

        {/* Fila 2: mapa */}
        <section className="w-full shrink-0 border-b border-[#E8E8E8] bg-[#eef0ed] px-2 py-2">
          <div
            className="relative w-full h-[min(42vh,380px)] min-h-[220px] max-h-[480px] rounded-xl overflow-hidden border border-[#ddd]"
            ref={mapRef as React.RefObject<HTMLDivElement>}
          >
            {!plan && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center pointer-events-none px-6">
                <p className="text-[#8a8a8a] text-sm">
                  La ruta aparecerá aquí cuando el asistente la calcule.
                </p>
              </div>
            )}
            <RouteMap
              plan={plan}
              onWaypointDrag={handleWaypointDrag}
              onMapInteract={() => {}}
            />
          </div>
        </section>

        {/* Fila 3: itinerario (curable) */}
        <section className="flex-1 min-h-[200px] overflow-y-auto bg-[#FAFAFA] border-t border-[#E8E8E8] pb-8">
          <RouteLedger
            plan={plan}
            scrapePending={scrapePending}
            freshnessLabel={currentFreshnessLabel}
            onSelectScrapedFlight={handlePickScrapedFlight}
            onDismissTransitOperator={handleDismissTransitOperator}
            onDismissScrapedFlight={handleDismissScrapedFlight}
            onDismissAviationFlight={handleDismissAviationFlight}
            onDismissSegment={handleDismissSegment}
          />
          {plan && address && (
            <div className="px-4 pb-6">
              <MintButton
                plan={plan}
                creatorAddress={address as `0x${string}`}
                onMinted={(hash) => setMintSuccess(hash)}
              />
              {mintSuccess && (
                <p className="mt-2 text-xs text-[#6B8E6B] text-center">
                  ¡Ruta guardada en tu Pasaporte!
                </p>
              )}
            </div>
          )}
          {plan && !address && (
            <div className="px-4 pb-6">
              <p className="text-xs text-[#8a8a8a] text-center">
                Conectá tu wallet para guardar la ruta en tu Pasaporte.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
