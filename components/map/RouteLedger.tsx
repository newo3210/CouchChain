"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bus,
  ChevronDown,
  Crosshair,
  MapPin,
  Plus,
  Plane,
  Trash2,
  Sparkles,
} from "lucide-react";
import {
  RoutePlan,
  ScrapedFlightQuote,
  TransportSegment,
  Waypoint,
} from "@/lib/types/route";

const MODE_LABELS: Record<string, string> = {
  car: "Auto / ruta",
  bus: "Bus",
  plane: "Vuelo",
  walk: "A pie",
  bike: "Bici",
  ferry: "Ferry",
};

function PriceLine({ seg }: { seg: TransportSegment }) {
  if (!seg.price) return null;
  const { amount, currency, freshness } = seg.price;
  const color =
    freshness === "live" ? "text-[#0d9488]" : "text-[#64748b]";
  return (
    <span className={`font-mono text-xs ${color}`}>
      {currency} {amount.toLocaleString("es-AR")}
    </span>
  );
}

const bubbleSpring = { type: "spring" as const, stiffness: 400, damping: 28 };

const dockContainerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.085,
      delayChildren: 0.06,
    },
  },
};

const dockItemVariants = {
  hidden: { opacity: 0, x: -36, scale: 0.94 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 420, damping: 26 },
  },
};

function DockWaypointBubble({
  wp,
  i,
  waypointCount,
  expandedWpId,
  onToggleExpand,
  activeWaypointId,
  onWaypointActivate,
  onRemoveWaypoint,
}: {
  wp: Waypoint;
  i: number;
  waypointCount: number;
  expandedWpId: string | null;
  onToggleExpand: (id: string) => void;
  activeWaypointId?: string | null;
  onWaypointActivate?: (id: string) => void;
  onRemoveWaypoint?: (id: string) => void;
}) {
  const open = expandedWpId === wp.id;
  const isStop = wp.type === "stop";
  const isActive = activeWaypointId === wp.id;
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const clearLong = () => {
    if (longTimer.current) {
      clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  const onPointerDown = () => {
    longFired.current = false;
    clearLong();
    longTimer.current = setTimeout(() => {
      longFired.current = true;
      onToggleExpand(wp.id);
    }, 480);
  };

  const onPointerUp = () => {
    clearLong();
    if (!longFired.current) {
      onWaypointActivate?.(wp.id);
    }
  };

  return (
    <motion.div
      layout
      variants={dockItemVariants}
      className={`snap-start shrink-0 min-w-[208px] max-w-[248px] overflow-hidden rounded-2xl border-2 bg-[#fafaf9] shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] transition-shadow ${
        isActive
          ? "border-[#0f172a] shadow-[0_10px_36px_-10px_rgba(15,23,42,0.35)]"
          : "border-[#e7e5e4]"
      }`}
    >
      <div
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={clearLong}
        onPointerLeave={clearLong}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            wp.type === "origin"
              ? "bg-[#e2e8f0] text-[#1e293b]"
              : wp.type === "destination"
                ? "bg-[#cbd5e1] text-[#0f172a]"
                : "bg-[#f1f5f9] text-[#475569]"
          }`}
        >
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#0f172a] truncate">{wp.name}</p>
          <p className="text-[10px] uppercase tracking-wide text-[#64748b]">
            {wp.type === "origin"
              ? "Origen"
              : wp.type === "destination"
                ? "Destino"
                : "Parada"}
            {waypointCount > 1 ? ` · ${i + 1}/${waypointCount}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
          aria-expanded={open}
          aria-label={open ? "Cerrar opciones" : "Expandir opciones"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(wp.id);
          }}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
            className="border-t border-[#e7e5e4]"
          >
            <div className="space-y-2 px-3 py-3 text-xs text-[#475569]">
              <p className="font-mono text-[11px] text-[#64748b]">
                {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
              </p>
              <p className="text-[10px] text-[#94a3b8]">
                Mantené presionado la tarjeta o usá la flecha para curar la
                parada.
              </p>
              <div className="flex flex-wrap gap-2">
                {onWaypointActivate && (
                  <button
                    type="button"
                    onClick={() => onWaypointActivate(wp.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#e7e5e4] bg-[#f8fafc] px-3 py-1.5 text-[11px] font-medium text-[#0f172a] hover:bg-[#f1f5f9]"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    Ver en mapa
                  </button>
                )}
                {isStop && onRemoveWaypoint && (
                  <button
                    type="button"
                    onClick={() => onRemoveWaypoint(wp.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#fecaca] bg-[#fef2f2] px-3 py-1.5 text-[11px] font-medium text-[#991b1b] hover:bg-[#fee2e2]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Quitar parada
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface Props {
  plan: RoutePlan | null;
  scrapePending?: boolean;
  freshnessLabel?: string;
  onSelectScrapedFlight?: (quote: ScrapedFlightQuote) => void;
  onDismissTransitOperator?: (operatorName: string) => void;
  onDismissScrapedFlight?: (index: number) => void;
  onDismissAviationFlight?: (index: number) => void;
  onDismissSegment?: (index: number) => void;
  onWaypointActivate?: (id: string) => void;
  activeWaypointId?: string | null;
  onAddStop?: () => void;
  onRemoveWaypoint?: (id: string) => void;
}

export default function RouteLedger({
  plan,
  scrapePending,
  freshnessLabel,
  onSelectScrapedFlight,
  onDismissTransitOperator,
  onDismissScrapedFlight,
  onDismissAviationFlight,
  onDismissSegment,
  onWaypointActivate,
  activeWaypointId,
  onAddStop,
  onRemoveWaypoint,
}: Props) {
  const flightQuotes = plan?.scrapedFlightQuotes ?? [];
  const [flightPick, setFlightPick] = useState(0);
  const [expandedWp, setExpandedWp] = useState<string | null>(null);

  useEffect(() => {
    setFlightPick((p) =>
      flightQuotes.length === 0 ? 0 : Math.min(p, flightQuotes.length - 1),
    );
  }, [plan?.id, flightQuotes.length]);

  useEffect(() => {
    setExpandedWp(null);
  }, [plan?.id]);

  if (!plan) {
    return (
      <div className="px-4 py-6 text-sm text-[#64748b] text-center">
        Pedí una ruta arriba: las paradas aparecerán acá en el dock.
      </div>
    );
  }

  const toggleWp = (id: string) =>
    setExpandedWp((x) => (x === id ? null : id));

  return (
    <div className="px-3 py-4 space-y-3 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
          Dock · Paradas
        </h2>
        {scrapePending ? (
          <span className="text-[10px] text-[#b45309] animate-pulse">
            Precios…
          </span>
        ) : freshnessLabel ? (
          <span className="text-[10px] text-[#0d9488]">{freshnessLabel}</span>
        ) : null}
      </div>

      <motion.div
        key={plan.id}
        className="flex gap-2.5 overflow-x-auto pb-2 pt-1 pl-0.5 pr-1 snap-x [scrollbar-width:thin]"
        variants={dockContainerVariants}
        initial="hidden"
        animate="show"
      >
        {plan.waypoints.map((wp, i) => (
          <DockWaypointBubble
            key={wp.id}
            wp={wp}
            i={i}
            waypointCount={plan.waypoints.length}
            expandedWpId={expandedWp}
            onToggleExpand={toggleWp}
            activeWaypointId={activeWaypointId}
            onWaypointActivate={onWaypointActivate}
            onRemoveWaypoint={onRemoveWaypoint}
          />
        ))}
        {onAddStop && (
          <motion.button
            type="button"
            layout
            variants={dockItemVariants}
            onClick={onAddStop}
            className="snap-start shrink-0 flex min-w-[168px] max-w-[200px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm font-medium text-[#334155] shadow-sm transition-colors hover:border-[#94a3b8] hover:bg-[#f1f5f9]"
          >
            <Plus className="h-5 w-5" />
            Parada
          </motion.button>
        )}
      </motion.div>

      {plan.transportSegments.map((seg, i) => (
        <motion.div
          layout
          key={`seg-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={bubbleSpring}
          className="rounded-2xl border border-[#e7e5e4] bg-[#fafaf9] px-4 py-3 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.12)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <Bus className="h-4 w-4 text-[#475569] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#0f172a]">
                  {MODE_LABELS[seg.mode] ?? seg.mode} · {seg.durationMinutes} min
                  {seg.distanceKm != null ? ` · ${seg.distanceKm} km` : ""}
                </p>
                <p className="text-[11px] text-[#64748b] truncate mt-0.5">
                  {seg.from.name} → {seg.to.name}
                </p>
                {seg.transitProvider && (
                  <p className="text-[10px] text-[#94a3b8] mt-1">
                    {seg.transitProvider}
                  </p>
                )}
                {seg.price && (
                  <div className="mt-1">
                    <PriceLine seg={seg} />
                  </div>
                )}
              </div>
            </div>
            {onDismissSegment && plan.transportSegments.length > 1 && (
              <button
                type="button"
                onClick={() => onDismissSegment(i)}
                className="shrink-0 rounded-full p-1.5 text-[#991b1b] hover:bg-[#fef2f2]"
                aria-label="Quitar tramo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-[#94a3b8] mt-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Ruta principal (OSRM). Ajustá paradas en el dock para recalcular.
          </p>
        </motion.div>
      ))}

      {plan.weather && (
        <motion.div
          layout
          className="rounded-2xl border border-[#e7e5e4] bg-[#f8fafc] px-4 py-3 text-xs text-[#475569]"
        >
          <span className="font-medium">Clima:</span>{" "}
          {plan.weather.temperatureC}°C · {plan.weather.condition} · viento{" "}
          {plan.weather.windKmh} km/h
        </motion.div>
      )}

      {plan.transitFeeds.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b] px-1">
            Operadores ({plan.transitFeeds.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
            {plan.transitFeeds.map((f, i) => (
              <motion.div
                key={`${f.operatorName}-${i}`}
                layout
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="snap-start shrink-0 max-w-[200px] rounded-xl border border-[#e7e5e4] bg-[#fafaf9] px-3 py-2 shadow-sm"
              >
                <p className="text-[11px] font-medium text-[#0f172a] truncate">
                  {f.operatorName}
                </p>
                <div className="mt-1 flex gap-2">
                  {f.feedUrl && (
                    <a
                      href={
                        f.feedUrl.startsWith("http")
                          ? f.feedUrl
                          : `https://${f.feedUrl}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#475569] underline-offset-2 hover:underline"
                    >
                      web
                    </a>
                  )}
                  {onDismissTransitOperator && (
                    <button
                      type="button"
                      onClick={() => onDismissTransitOperator(f.operatorName)}
                      className="text-[10px] text-[#991b1b]"
                    >
                      quitar
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {flightQuotes.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0f766e] px-1 flex items-center gap-1">
            <Plane className="h-3 w-3" />
            Vuelos cotizados
          </p>
          <div className="space-y-2">
            {flightQuotes.map((q, i) => (
              <motion.div
                key={`${q.provider}-${i}-${q.price}`}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[#e7e5e4] bg-[#f8fafc] px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <label className="flex flex-1 cursor-pointer gap-2 min-w-0">
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
                    <span className="min-w-0 text-xs">
                      <span className="font-medium text-[#0f172a] block truncate">
                        {q.provider}
                      </span>
                      <span className="font-mono text-[#0d9488]">
                        {q.currency} {q.price.toLocaleString("es-AR")}
                      </span>
                      {q.departure && (
                        <span className="block text-[10px] text-[#8a8a8a]">
                          {q.departure}
                        </span>
                      )}
                    </span>
                  </label>
                  {onDismissScrapedFlight && (
                    <button
                      type="button"
                      onClick={() => onDismissScrapedFlight(i)}
                      className="shrink-0 p-1 text-[#991b1b]"
                      aria-label="Quitar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {plan.flightAlternatives && plan.flightAlternatives.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase text-[#64748b] px-1">
            Itinerarios aéreos (referencia)
          </p>
          {plan.flightAlternatives.map((f, i) => (
            <motion.div
              key={i}
              layout
              className="flex items-start justify-between gap-2 rounded-xl border border-[#e7e5e4] bg-[#fafaf9] px-3 py-2 text-[11px] font-mono text-[#475569]"
            >
              <span className="min-w-0">
                {f.airline ?? "—"}{" "}
                {f.flightNumber && `· ${f.flightNumber}`}
                {f.scheduledDeparture && (
                  <span className="text-[#94a3b8]"> · {f.scheduledDeparture}</span>
                )}
              </span>
              {onDismissAviationFlight && (
                <button
                  type="button"
                  onClick={() => onDismissAviationFlight(i)}
                  className="shrink-0 text-[#991b1b] p-0.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-[#94a3b8] px-1 pt-2 text-center">
        Presupuesto: {plan.estimatedBudget.currency}{" "}
        {plan.estimatedBudget.amount > 0
          ? plan.estimatedBudget.amount.toLocaleString("es-AR")
          : "—"}
      </p>
    </div>
  );
}
