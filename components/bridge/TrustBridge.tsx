"use client";
import { useState } from "react";
import { useAccount } from "wagmi";

const TEMPLATES = {
  stay: "Solicitud de estadía",
  availability: "Consulta de disponibilidad",
  exchange: "Propuesta de intercambio (habilidad por hospedaje)",
};

interface Props {
  hostWallet: string;
  hostName?: string;
  activeRouteId?: string;
  onClose?: () => void;
}

type FlowState = "select" | "note" | "sent" | "error";

export default function TrustBridge({
  hostWallet,
  hostName,
  activeRouteId,
  onClose,
}: Props) {
  const { address, isConnected } = useAccount();
  const [template, setTemplate] = useState<keyof typeof TEMPLATES | "">("");
  const [note, setNote] = useState("");
  const [flowState, setFlowState] = useState<FlowState>("select");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSend() {
    if (!template || !isConnected || !address) return;
    setFlowState("note");
  }

  async function handleSubmit() {
    if (!template || !address) return;

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travelerWallet: address,
          hostWallet,
          templateType: template,
          note: note.slice(0, 140) || undefined,
          routeId: activeRouteId,
        }),
      });

      if (!res.ok) throw new Error("Error al enviar");
      setFlowState("sent");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error");
      setFlowState("error");
    }
  }

  if (!isConnected) {
    return (
      <div className="p-4 text-sm text-[#5c5c5c]">
        Conectá tu wallet para contactar al anfitrión.
      </div>
    );
  }

  if (flowState === "sent") {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-2xl">🤝</p>
        <p className="font-medium text-[#1a1a1a]">Solicitud enviada</p>
        <p className="text-sm text-[#5c5c5c]">
          {hostName ?? hostWallet.slice(0, 10)} recibirá tu mensaje. Si responde &ldquo;Disponible&rdquo;, te
          compartiremos su contacto directo.
        </p>
        <button
          onClick={onClose}
          className="mt-2 px-4 py-2 rounded-lg bg-[#8B7355] text-white text-sm hover:bg-[#7a6549] transition-colors"
        >
          Cerrar
        </button>
      </div>
    );
  }

  if (flowState === "error") {
    return (
      <div className="p-4 text-sm text-[#B85C5C]">
        {errorMsg}
        <button
          className="ml-2 underline"
          onClick={() => setFlowState("select")}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (flowState === "note") {
    return (
      <div className="p-4 space-y-4">
        <h4 className="font-semibold text-[#1a1a1a] text-sm">
          {TEMPLATES[template as keyof typeof TEMPLATES]}
        </h4>
        <div>
          <label className="block text-xs text-[#5c5c5c] mb-1">
            Nota personal (opcional, máx. 140 caracteres)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 140))}
            rows={3}
            placeholder="Hola, llego el 15 de marzo..."
            className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm text-[#1a1a1a] placeholder-[#8a8a8a] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 resize-none"
          />
          <p className="text-xs text-[#8a8a8a] text-right">{note.length}/140</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFlowState("select")}
            className="flex-1 px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm text-[#5c5c5c] hover:bg-[#FAFAFA] transition-colors"
          >
            Atrás
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-3 py-2 rounded-lg bg-[#8B7355] text-white text-sm font-medium hover:bg-[#7a6549] transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>
    );
  }

  // select template
  return (
    <div className="p-4 space-y-4">
      <h4 className="font-semibold text-[#1a1a1a] text-sm">
        Contactar a {hostName ?? hostWallet.slice(0, 10) + "…"}
      </h4>
      <div className="space-y-2">
        {(Object.entries(TEMPLATES) as [keyof typeof TEMPLATES, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setTemplate(key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                template === key
                  ? "border-[#8B7355] bg-[#f5f0e8] text-[#1a1a1a]"
                  : "border-[#E8E8E8] text-[#5c5c5c] hover:border-[#8B7355]/40"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>
      <button
        onClick={handleSend}
        disabled={!template}
        className="w-full px-4 py-2.5 rounded-lg bg-[#8B7355] text-white text-sm font-medium hover:bg-[#7a6549] disabled:opacity-40 transition-colors"
      >
        Continuar
      </button>
    </div>
  );
}
