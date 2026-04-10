"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import type { RoutePlan, RoutePlanResponse } from "@/lib/types/route";

export type GatitoState = "idle" | "processing" | "success" | "error" | "sleeping";

const SPRITES: Record<GatitoState, string> = {
  idle: "/gatito/idle.svg",
  processing: "/gatito/processing.svg",
  success: "/gatito/success.svg",
  error: "/gatito/error.svg",
  sleeping: "/gatito/sleeping.svg",
};

const SLEEP_AFTER_MS = 60_000;
const TYPING_SETTLE_MS = 620;

interface Props {
  onRoutePlan?: (plan: RoutePlan, scrapeJobId?: string) => void;
  variant?: "overlay" | "floating";
  mapContainerRef?: React.RefObject<HTMLElement | null>;
}

export default function GatitoAssistant({
  onRoutePlan,
  variant = "overlay",
  mapContainerRef,
}: Props) {
  const floating = variant === "floating";
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<GatitoState>("idle");
  const [caption, setCaption] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [spriteFailed, setSpriteFailed] = useState(false);
  const [settledTyping, setSettledTyping] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setState("sleeping"), SLEEP_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!input.trim()) {
      setSettledTyping(false);
      return;
    }
    setSettledTyping(false);
    const t = setTimeout(() => setSettledTyping(true), TYPING_SETTLE_MS);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    if (floating && mapContainerRef?.current) {
      const el = mapContainerRef.current;
      const handler = () => setExpanded(false);
      el.addEventListener("mouseenter", handler);
      return () => el.removeEventListener("mouseenter", handler);
    }
  }, [floating, mapContainerRef]);

  useEffect(() => {
    setSpriteFailed(false);
  }, [state]);

  const showPeek =
    !floating &&
    (state === "processing" ||
      state === "success" ||
      state === "error" ||
      (input.trim().length > 0 && settledTyping));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    setInput("");
    setCaption(null);
    setSettledTyping(false);
    setState("processing");

    try {
      const res = await fetch("/api/route-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg =
          typeof payload.error === "string"
            ? payload.error
            : "Error en el servidor";
        throw new Error(errMsg);
      }

      const data = payload as RoutePlanResponse;
      setState("success");
      onRoutePlan?.(data.plan, data.scrapeJobId);
      setTimeout(() => setState("idle"), 2800);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Algo falló. Intentá de nuevo.";
      setState("error");
      setCaption(msg);
      setTimeout(() => setState("idle"), 4500);
    }
  }

  const isEarsOnly = floating && !expanded;

  const commandFormClasses =
    "flex items-center gap-2 rounded-full border border-[#e7e5e4] bg-[#fafaf9] px-4 py-2.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.28),0_2px_8px_-2px_rgba(15,23,42,0.12)]";

  const floatingCommandBar = (
    <motion.div
      className="pointer-events-auto relative z-30 w-full max-w-md mx-auto px-4 pt-4"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, mass: 0.85 }}
    >
      <form onSubmit={handleSubmit} className={`relative z-30 ${commandFormClasses}`}>
        <Sparkles className="w-4 h-4 text-[#334155] shrink-0" aria-hidden />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pedí tu ruta en lenguaje natural…"
          disabled={state === "processing"}
          className="flex-1 min-w-0 bg-transparent text-[15px] text-[#0f172a] placeholder:text-[#64748b] outline-none border-0 focus:ring-0"
        />
        <button
          type="submit"
          disabled={state === "processing" || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-[#fafaf9] shadow-md transition enabled:hover:bg-[#0f172a] disabled:opacity-40"
          aria-label="Enviar"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </form>
      <AnimatePresence mode="wait">
        {caption && (
          <motion.p
            key={caption.slice(0, 24)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 px-3 text-xs leading-relaxed text-[#b91c1c] line-clamp-4"
            role="alert"
          >
            {caption}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const sprite = (
    <motion.div
      className={`relative ${floating ? "h-32 w-32" : "h-[5.25rem] w-[5.25rem]"} shrink-0 cursor-pointer select-none`}
      style={{
        transform: isEarsOnly ? "translateY(calc(100% - 20px))" : undefined,
      }}
      initial={{ y: 18, opacity: 0 }}
      animate={{
        y: isEarsOnly ? 48 : 0,
        opacity: 1,
      }}
      transition={{
        y: { type: "spring", stiffness: 280, damping: 24 },
        opacity: { duration: 0.35 },
      }}
      onClick={() => {
        if (floating) setExpanded((e) => !e);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SPRITES[state]}
        alt=""
        width={floating ? 128 : 84}
        height={floating ? 128 : 84}
        className="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-lg"
        style={{
          imageRendering: "pixelated",
          visibility: spriteFailed ? "hidden" : "visible",
        }}
        onLoad={() => setSpriteFailed(false)}
        onError={() => setSpriteFailed(true)}
      />
      {spriteFailed && (
        <span className="absolute inset-0 flex items-center justify-center text-3xl">
          🐱
        </span>
      )}
    </motion.div>
  );

  if (floating) {
    return (
      <div className="fixed bottom-0 right-4 z-50 flex flex-col items-end pointer-events-none">
        {expanded && (
          <div className="mb-2 pointer-events-auto w-80 max-w-[calc(100vw-1.5rem)]">
            {floatingCommandBar}
          </div>
        )}
        <div className="pointer-events-auto">{sprite}</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 top-0 z-40 pointer-events-none flex justify-center px-0">
      <motion.div
        className="pointer-events-auto relative w-full max-w-md px-4 pt-4"
        initial={{ y: -120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24, mass: 0.85 }}
      >
        <AnimatePresence>
          {showPeek && (
            <motion.div
              key="peek"
              className="pointer-events-none absolute left-0 top-[52px] z-20 w-[5.25rem] sm:top-[54px]"
              initial={{ y: 32, opacity: 0, scale: 0.88 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 22, opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 340, damping: 27 }}
            >
              {sprite}
            </motion.div>
          )}
        </AnimatePresence>
        <form
          onSubmit={handleSubmit}
          className={`relative z-30 ${commandFormClasses}`}
        >
          <Sparkles className="w-4 h-4 text-[#334155] shrink-0" aria-hidden />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pedí tu ruta en lenguaje natural…"
            disabled={state === "processing"}
            className="flex-1 min-w-0 bg-transparent text-[15px] text-[#0f172a] placeholder:text-[#64748b] outline-none border-0 focus:ring-0"
          />
          <button
            type="submit"
            disabled={state === "processing" || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-[#fafaf9] shadow-md transition enabled:hover:bg-[#0f172a] disabled:opacity-40"
            aria-label="Enviar"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
        <AnimatePresence mode="wait">
          {caption && (
            <motion.p
              key={caption.slice(0, 24)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative z-30 mt-2 px-3 text-xs leading-relaxed text-[#b91c1c] line-clamp-4"
              role="alert"
            >
              {caption}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
