"use client";
import dynamic from "next/dynamic";
import { useRef, useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { RoutePlan } from "@/lib/types/route";
import Header from "@/components/ui/Header";
import RouteLedger from "@/components/map/RouteLedger";
import MintButton from "@/components/ui/MintButton";
import { freshnessLabel } from "@/lib/validation-pipeline";

// Leaflet must be client-only
const RouteMap = dynamic(() => import("@/components/map/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#E8E8E8] rounded-xl animate-pulse flex items-center justify-center text-[#8a8a8a] text-sm">
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
  const [ledgerOpen, setLedgerOpen] = useState(true);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);

  // Poll for scrape job status
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
          // Update plan segments with verified prices
          if (data.result?.length && plan) {
            setPlan((prev) => {
              if (!prev) return prev;
              const updatedSegments = prev.transportSegments.map((seg, i) => {
                const match = data.result[i];
                if (!match) return seg;
                return {
                  ...seg,
                  price: {
                    amount: match.price,
                    currency: match.currency,
                    source: "scraper" as const,
                    freshness: "live" as const,
                    verifiedAt: data.completedAt,
                  },
                  transitProvider: match.provider,
                };
              });
              return { ...prev, transportSegments: updatedSegments };
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
    setLedgerOpen(true);
    setMintSuccess(null);
    setFreshnessLabel("");
  }, []);

  const handleWaypointDrag = useCallback(
    async (waypointId: string, lat: number, lng: number) => {
      if (!plan) return;
      const waypoint = plan.waypoints.find((w) => w.id === waypointId);
      if (!waypoint) return;

      // Update waypoint coords
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

      <main className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>
        {/* Map canvas */}
        <div className="relative flex-1" ref={mapRef as React.RefObject<HTMLDivElement>}>
          {!plan && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center pointer-events-none px-8">
              <p className="text-[#8a8a8a] text-sm max-w-xs">
                Escribile al Gatito en la esquina inferior derecha para planificar tu ruta.
              </p>
            </div>
          )}
          <RouteMap
            plan={plan}
            onWaypointDrag={handleWaypointDrag}
            onMapInteract={() => {}}
          />
        </div>

        {/* Route Ledger */}
        <div
          className={`
            flex-shrink-0 bg-[#FAFAFA] border-l border-[#E8E8E8] overflow-y-auto
            transition-all duration-300
            ${ledgerOpen ? "w-72" : "w-0"}
          `}
        >
          {ledgerOpen && (
            <>
              <RouteLedger
                plan={plan}
                scrapePending={scrapePending}
                freshnessLabel={currentFreshnessLabel}
              />
              {plan && address && (
                <div className="px-4 pb-4">
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
                <div className="px-4 pb-4">
                  <p className="text-xs text-[#8a8a8a] text-center">
                    Conectá tu wallet para guardar la ruta en tu Pasaporte.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Ledger toggle */}
        <button
          onClick={() => setLedgerOpen((o) => !o)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white border border-[#E8E8E8] rounded-l-lg px-1.5 py-3 text-[#5c5c5c] hover:bg-[#FAFAFA] text-xs shadow-sm"
          title={ledgerOpen ? "Ocultar itinerario" : "Ver itinerario"}
          style={{ right: ledgerOpen ? "18rem" : "0" }}
        >
          {ledgerOpen ? "›" : "‹"}
        </button>
      </main>

      <GatitoAssistant
        onRoutePlan={handleRoutePlan}
        mapContainerRef={mapRef as React.RefObject<HTMLElement>}
      />
    </div>
  );
}
