"use client";
import dynamic from "next/dynamic";
import { useRef, useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import type {
  RoutePlan,
  TransportSegment,
  Waypoint,
} from "@/lib/types/route";
import type { RouteMapHandle } from "@/components/map/RouteMap";
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
    <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#e7e5e4] text-sm text-[#64748b] animate-pulse">
      Cargando mapa…
    </div>
  ),
});

const GatitoAssistant = dynamic(
  () => import("@/components/gatito/GatitoAssistant"),
  { ssr: false },
);

async function refreshPlanWaypoints(
  base: RoutePlan,
  wps: Waypoint[],
): Promise<RoutePlan> {
  if (wps.length < 2) {
    return { ...base, waypoints: wps, transportSegments: [] };
  }
  try {
    const res = await fetch("/api/waypoints-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waypoints: wps.map((w) => ({ name: w.name, lat: w.lat, lng: w.lng })),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { segments: TransportSegment[] };
      return { ...base, waypoints: wps, transportSegments: data.segments };
    }
  } catch {
    /* ignore */
  }
  return { ...base, waypoints: wps };
}

export default function Home() {
  const { address } = useAccount();
  const mapApiRef = useRef<RouteMapHandle | null>(null);

  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [scrapeJobId, setScrapeJobId] = useState<string | undefined>();
  const [scrapePending, setScrapePending] = useState(false);
  const [currentFreshnessLabel, setFreshnessLabel] = useState<string>("");
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [activeWaypointId, setActiveWaypointId] = useState<string | null>(null);

  const planFitKey = plan
    ? [
        plan.id,
        ...plan.waypoints.map(
          (w) => `${w.id}:${w.lat.toFixed(5)},${w.lng.toFixed(5)}`,
        ),
      ].join("|")
    : "";

  useEffect(() => {
    if (!plan?.waypoints.length) return;
    const id = requestAnimationFrame(() => mapApiRef.current?.fitToPlan());
    return () => cancelAnimationFrame(id);
  }, [planFitKey, plan?.waypoints.length]);

  useEffect(() => {
    setActiveWaypointId(null);
  }, [plan?.id]);

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

  const handleWaypointSelect = useCallback((id: string) => {
    setActiveWaypointId(id);
    mapApiRef.current?.focusWaypoint(id);
  }, []);

  const handleAddStop = useCallback(() => {
    const q = window.prompt("Nombre o dirección de la nueva parada:");
    if (!q?.trim()) return;

    void (async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(q.trim())}`,
        );
        if (!res.ok) {
          window.alert("No encontramos ese lugar.");
          return;
        }
        const geo = (await res.json()) as {
          name: string;
          lat: number;
          lng: number;
        };

        setPlan((base) => {
          if (!base) {
            window.alert("Primero pedí una ruta con el asistente.");
            return base;
          }
          const dest = base.waypoints.find((w) => w.type === "destination");
          const withoutDest = base.waypoints.filter(
            (w) => w.type !== "destination",
          );
          const newStop: Waypoint = {
            id: crypto.randomUUID(),
            type: "stop",
            name: geo.name,
            lat: geo.lat,
            lng: geo.lng,
          };
          const wps = dest
            ? [...withoutDest, newStop, dest]
            : [...base.waypoints, newStop];

          void refreshPlanWaypoints(base, wps).then(setPlan);
          return { ...base, waypoints: wps };
        });
      } catch {
        window.alert("Error al geocodificar.");
      }
    })();
  }, []);

  const handleRemoveWaypoint = useCallback((id: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const wp = prev.waypoints.find((w) => w.id === id);
      if (!wp || wp.type !== "stop") return prev;
      const wps = prev.waypoints.filter((w) => w.id !== id);
      void refreshPlanWaypoints(prev, wps).then(setPlan);
      return { ...prev, waypoints: wps };
    });
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
    (waypointId: string, lat: number, lng: number) => {
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          waypoints: prev.waypoints.map((w) =>
            w.id === waypointId ? { ...w, lat, lng } : w,
          ),
        };
      });
    },
    [],
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f4] text-[#0f172a]">
      <Header />

      <main className="flex-1 flex flex-col min-h-0 w-full max-w-lg mx-auto">
        <section
          className="relative w-full shrink-0 h-[min(56vh,480px)] min-h-[300px] max-h-[560px] overflow-hidden rounded-b-3xl border-x border-b border-[#e7e5e4] bg-[#e7e5e4] shadow-[0_24px_60px_-24px_rgba(15,23,42,0.2)]"
          aria-label="Mapa y asistente"
        >
          <div className="absolute inset-0 z-0">
            <RouteMap
              ref={mapApiRef}
              plan={plan}
              onWaypointDrag={handleWaypointDrag}
              onMapInteract={() => {}}
            />
          </div>

          {!plan && (
            <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center px-6 text-center">
              <p className="text-sm text-[#64748b]">
                La ruta aparecerá en el mapa cuando el asistente la calcule.
              </p>
            </div>
          )}

          <GatitoAssistant variant="overlay" onRoutePlan={handleRoutePlan} />
        </section>

        <section className="flex-1 min-h-[200px] overflow-y-auto bg-[#f5f5f4] border-t border-[#e7e5e4] pb-8">
          <RouteLedger
            plan={plan}
            scrapePending={scrapePending}
            freshnessLabel={currentFreshnessLabel}
            onSelectScrapedFlight={handlePickScrapedFlight}
            onDismissTransitOperator={handleDismissTransitOperator}
            onDismissScrapedFlight={handleDismissScrapedFlight}
            onDismissAviationFlight={handleDismissAviationFlight}
            onDismissSegment={handleDismissSegment}
            activeWaypointId={activeWaypointId}
            onWaypointActivate={handleWaypointSelect}
            onAddStop={handleAddStop}
            onRemoveWaypoint={handleRemoveWaypoint}
          />
          {plan && address && (
            <div className="px-4 pb-6">
              <MintButton
                plan={plan}
                creatorAddress={address as `0x${string}`}
                onMinted={(hash) => setMintSuccess(hash)}
              />
              {mintSuccess && (
                <p className="mt-2 text-xs text-[#0d9488] text-center">
                  ¡Ruta guardada en tu Pasaporte!
                </p>
              )}
            </div>
          )}
          {plan && !address && (
            <div className="px-4 pb-6">
              <p className="text-xs text-[#64748b] text-center">
                Conectá tu wallet para guardar la ruta en tu Pasaporte.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
