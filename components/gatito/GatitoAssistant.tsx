"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import type {
  ParsedIntent,
  RoutePlan,
  RoutePlanErrorDebug,
  RoutePlanResponse,
} from "@/lib/types/route";

// ─── Sprite map ────────────────────────────────────────────────────────────────
// SVG incluidos en /public/gatito/ (sin 404 en deploy). Podés sustituir por GIF pixel-art con el mismo nombre base.
export type GatitoState = "idle" | "processing" | "success" | "error" | "sleeping";

const SPRITES: Record<GatitoState, string> = {
  idle: "/gatito/idle.svg",
  processing: "/gatito/processing.svg",
  success: "/gatito/success.svg",
  error: "/gatito/error.svg",
  sleeping: "/gatito/sleeping.svg",
};

interface Props {
  onRoutePlan?: (plan: RoutePlan, scrapeJobId?: string) => void;
  /** Referencia al mapa: en modo flotante, al pasar el mouse se pliega el chat. */
  mapContainerRef?: React.RefObject<HTMLElement | null>;
  /** embedded = primera fila del layout móvil (ancho completo). floating = esquina inferior. */
  layout?: "embedded" | "floating";
}

const SLEEP_AFTER_MS = 60_000; // go sleeping after 60s idle

const LS_ROUTE_DEBUG = "couchchain:routeDebug";

function readRouteDebugFlag(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_ROUTE_DEBUG === "true") return true;
  try {
    return window.localStorage.getItem(LS_ROUTE_DEBUG) === "1";
  } catch {
    return false;
  }
}

export default function GatitoAssistant({
  onRoutePlan,
  mapContainerRef,
  layout = "floating",
}: Props) {
  const embedded = layout === "embedded";
  const [expanded, setExpanded] = useState(embedded);
  const [state, setState] = useState<GatitoState>("idle");
  const [message, setMessage] = useState("");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<{ role: "user" | "gatito"; text: string }[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spriteFailed, setSpriteFailed] = useState(false);
  const [routeDebug, setRouteDebug] = useState(false);
  const [lastErrorDetail, setLastErrorDetail] = useState<{
    message: string;
    status: number;
    intent?: ParsedIntent;
    debug?: RoutePlanErrorDebug;
  } | null>(null);

  useEffect(() => {
    setRouteDebug(readRouteDebugFlag());
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  // Retract to ears when mouse enters map canvas (solo modo flotante)
  useEffect(() => {
    if (embedded) return;
    const el = mapContainerRef?.current;
    if (!el) return;
    const handler = () => setExpanded(false);
    el.addEventListener("mouseenter", handler);
    return () => el.removeEventListener("mouseenter", handler);
  }, [mapContainerRef, embedded]);

  // Sleep timer
  const resetSleepTimer = useCallback(() => {
    setState((s) => (s === "sleeping" ? "idle" : s));
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => setState("sleeping"), SLEEP_AFTER_MS);
  }, []);

  useEffect(() => {
    resetSleepTimer();
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, [resetSleepTimer]);

  useEffect(() => {
    setSpriteFailed(false);
  }, [state]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    setInput("");
    setHistory((h) => [...h, { role: "user", text: query }]);
    setState("processing");
    setMessage("Sigo conectando datos…");
    setLastErrorDetail(null);
    resetSleepTimer();

    let apiFault: {
      message: string;
      status: number;
      intent?: ParsedIntent;
      debug?: RoutePlanErrorDebug;
    } | null = null;

    try {
      const res = await fetch("/api/route-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          ...(routeDebug ? { debug: true } : {}),
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg =
          typeof payload.error === "string"
            ? payload.error
            : "Error en el servidor";
        apiFault = {
          message: errMsg,
          status: res.status,
          intent: payload.intent as ParsedIntent | undefined,
          debug: payload.debug as RoutePlanErrorDebug | undefined,
        };
        setLastErrorDetail(apiFault);
        throw new Error(errMsg);
      }

      const data = payload as RoutePlanResponse;
      setState("success");
      setMessage(data.plan.aiSynthesis);
      setHistory((h) => [...h, { role: "gatito", text: data.plan.aiSynthesis }]);
      onRoutePlan?.(data.plan, data.scrapeJobId);

      // Back to idle after 3s
      setTimeout(() => setState("idle"), 3000);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Algo falló. Intentá de nuevo.";
      setState("error");
      setMessage(msg);
      const note =
        apiFault?.debug != null
          ? ` (HTTP ${apiFault.status}; abrí «Último error del API» abajo).`
          : apiFault
            ? ` (HTTP ${apiFault.status}).`
            : "";
      setHistory((h) => [...h, { role: "gatito", text: msg + note }]);
      setTimeout(() => setState("idle"), 4000);
    }
  }

  function toggleRouteDebug(checked: boolean) {
    setRouteDebug(checked);
    try {
      if (checked) window.localStorage.setItem(LS_ROUTE_DEBUG, "1");
      else window.localStorage.removeItem(LS_ROUTE_DEBUG);
    } catch {
      /* ignore */
    }
  }

  const isVisible = expanded || embedded;
  const isEarsOnly = !embedded && !expanded;

  const chatBox = (
    <div
      ref={chatRef}
      className={`overflow-y-auto rounded-xl border border-[#E8E8E8] bg-white p-3 space-y-2 text-sm ${
        embedded ? "w-full max-h-36 min-h-[4.5rem]" : "mb-2 w-72 max-h-52 shadow-md"
      }`}
      style={
        embedded
          ? undefined
          : { boxShadow: "rgba(0,0,0,0.08) 0 0 0 1px, rgba(0,0,0,0.06) 0 4px 8px" }
      }
    >
      {history.length === 0 ? (
        embedded ? (
          <p className="text-xs text-[#8a8a8a] italic">
            Escribí tu ruta (ej. «de Lisboa a Madrid»).
          </p>
        ) : null
      ) : (
        history.map((h, i) => (
          <div
            key={i}
            className={`flex ${h.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`px-2.5 py-1.5 rounded-lg max-w-[90%] leading-relaxed ${
                h.role === "user"
                  ? "bg-[#8B7355] text-white"
                  : "bg-[#FAFAFA] text-[#1a1a1a] border border-[#E8E8E8]"
              }`}
            >
              {h.text}
            </span>
          </div>
        ))
      )}
    </div>
  );

  const formBlock = (
    <>
      <form
        onSubmit={handleSubmit}
        className={`mb-2 flex gap-2 ${embedded ? "w-full" : "w-80 max-w-[calc(100vw-2rem)]"}`}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="¿A dónde querés ir?"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#E8E8E8] bg-white text-sm text-[#1a1a1a] placeholder-[#8a8a8a] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
          disabled={state === "processing"}
          autoFocus={!embedded}
        />
        <button
          type="submit"
          disabled={state === "processing" || !input.trim()}
          className="shrink-0 px-3 py-2 rounded-lg bg-[#8B7355] text-white text-sm font-medium hover:bg-[#7a6549] disabled:opacity-50 transition-colors"
        >
          →
        </button>
      </form>
      <label
        className={`mb-2 flex cursor-pointer items-center gap-2 text-xs text-[#5c5c5c] ${embedded ? "w-full" : "w-80 max-w-[calc(100vw-2rem)]"}`}
      >
        <input
          type="checkbox"
          className="rounded border-[#ccc]"
          checked={routeDebug}
          onChange={(e) => toggleRouteDebug(e.target.checked)}
        />
        Depuración API
      </label>
      {lastErrorDetail && (
        <details
          className={`mb-2 rounded-lg border border-amber-200/80 bg-amber-50/90 p-2 text-xs text-[#3d3200] ${embedded ? "w-full" : "w-80 max-w-[calc(100vw-2rem)]"}`}
          open={routeDebug}
        >
          <summary className="cursor-pointer font-medium text-[#5c4a00]">
            Último error del API
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-[#1a1400]">
            {JSON.stringify(
              {
                httpStatus: lastErrorDetail.status,
                message: lastErrorDetail.message,
                intent: lastErrorDetail.intent,
                debug: lastErrorDetail.debug,
              },
              null,
              2,
            )}
          </pre>
        </details>
      )}
    </>
  );

  const sprite = (
    <div
      className={`relative cursor-pointer select-none shrink-0 ${
        embedded ? "h-24 w-24" : "h-32 w-32"
      }`}
      style={{
        transition: "transform 0.3s ease-out",
        transform: isEarsOnly ? "translateY(calc(100% - 20px))" : "translateY(0)",
      }}
      onClick={() => {
        if (!embedded) setExpanded((e) => !e);
        resetSleepTimer();
      }}
      title={embedded ? "Gatito asistente" : isEarsOnly ? "¡Hablar con el Gatito!" : "Cerrar"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SPRITES[state]}
        alt={`Gatito ${state}`}
        width={embedded ? 96 : 128}
        height={embedded ? 96 : 128}
        className="absolute inset-0 z-10 h-full w-full object-contain"
        style={{
          imageRendering: "pixelated",
          transition: "opacity 0.2s",
          visibility: spriteFailed ? "hidden" : "visible",
        }}
        onLoad={() => setSpriteFailed(false)}
        onError={() => setSpriteFailed(true)}
      />
      {spriteFailed && (
        <div
          className="absolute inset-0 z-0 flex items-center justify-center rounded-xl bg-[#e8dfd4] text-4xl"
          aria-hidden="true"
        >
          {state === "processing" && "🐱"}
          {state === "success" && "😺"}
          {state === "error" && "🙀"}
          {state === "sleeping" && "😴"}
          {state === "idle" && "🐱"}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <section
        className="w-full border-b border-[#E8DFD6] bg-gradient-to-b from-[#FFF9F3] to-[#FAF6F0]"
        style={{ willChange: "transform" }}
      >
        <div className="flex items-start gap-3 px-3 py-3 max-w-xl mx-auto w-full">
          {sprite}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#8B7355]">
              Asistente
            </p>
            {chatBox}
            {formBlock}
            {message && state !== "idle" && (
              <div className="text-xs text-[#5c5c5c]">{message}</div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-4 z-50 flex flex-col items-end"
      style={{ willChange: "transform" }}
    >
      {isVisible && history.length > 0 && chatBox}
      {isVisible && formBlock}
      {isVisible && message && state !== "idle" && (
        <div className="mb-1 text-xs text-[#5c5c5c] px-1 max-w-[18rem] text-right">
          {message}
        </div>
      )}
      {sprite}
    </div>
  );
}
