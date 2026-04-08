"use client";
import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import RoutePassportABI from "@/lib/abis/RoutePassport.json";
import { RoutePlan, RouteIpfsPayload } from "@/lib/types/route";

const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ?? "0x0";

interface Props {
  plan: RoutePlan;
  creatorAddress: `0x${string}`;
  onMinted?: (tokenId: string, ipfsCid: string) => void;
}

type MintState = "idle" | "uploading" | "confirming" | "done" | "error";

export default function MintButton({ plan, creatorAddress, onMinted }: Props) {
  const { isConnected } = useAccount();
  const [state, setState] = useState<MintState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [ipfsCid, setIpfsCid] = useState<string>("");

  const { writeContractAsync } = useWriteContract();

  async function handleMint() {
    if (!isConnected) {
      setErrorMsg("Conectá tu wallet primero");
      setState("error");
      return;
    }

    setState("uploading");
    setErrorMsg("");

    try {
      // Build IPFS payload
      const payload: RouteIpfsPayload = {
        version: "1.0",
        created_at: new Date().toISOString(),
        creator: creatorAddress,
        route_data: {
          origin: plan.origin,
          destination: plan.destination,
          waypoints: plan.waypoints,
          transport_segments: plan.transportSegments,
          estimated_budget: plan.estimatedBudget,
        },
        metadata: {
          tags: plan.tags,
          photos: [],
          ai_synthesis: plan.aiSynthesis,
          weather: plan.weather,
        },
      };

      // Upload to IPFS via API route (server-side Pinata call)
      const uploadRes = await fetch("/api/upload-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });

      if (!uploadRes.ok) throw new Error("Error al subir a IPFS");
      const { cid } = await uploadRes.json();
      setIpfsCid(cid);

      // Mint on-chain
      setState("confirming");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: RoutePassportABI,
        functionName: "createRoute",
        args: [cid],
      });

      // Save to index DB
      await fetch("/api/routes/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorWallet: creatorAddress,
          ipfsCid: cid,
          aiSynthesis: plan.aiSynthesis,
          tags: plan.tags,
          originName: plan.origin.name,
          destName: plan.destination.name,
          txHash: hash,
        }),
      });

      setState("done");
      onMinted?.(hash, cid);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error desconocido");
      setState("error");
    }
  }

  const labels: Record<MintState, string> = {
    idle: "Guardar en mi Pasaporte",
    uploading: "Subiendo a IPFS…",
    confirming: "Confirmando en blockchain…",
    done: "¡Ruta guardada!",
    error: "Reintentar",
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleMint}
        disabled={state === "uploading" || state === "confirming"}
        className={`
          w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all
          ${state === "done"
            ? "bg-[#6B8E6B] text-white"
            : state === "error"
            ? "bg-[#B85C5C] text-white hover:bg-red-700"
            : "bg-[#8B7355] text-white hover:bg-[#7a6549] disabled:opacity-60"}
        `}
      >
        {state === "uploading" || state === "confirming" ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            {labels[state]}
          </span>
        ) : (
          labels[state]
        )}
      </button>

      {state === "error" && errorMsg && (
        <p className="text-xs text-[#B85C5C] text-center">{errorMsg}</p>
      )}

      {state === "done" && ipfsCid && (
        <p className="text-xs text-[#6B8E6B] text-center font-mono truncate">
          IPFS: {ipfsCid.slice(0, 20)}…
        </p>
      )}
    </div>
  );
}
