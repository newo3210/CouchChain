"use client";
import { useAccount, useReadContract } from "wagmi";
import { useEffect, useState } from "react";
import TrustRegistryABI from "@/lib/abis/TrustRegistry.json";
import { ipfsUrl } from "@/lib/pinata-client";

const TRUST_REGISTRY =
  (process.env.NEXT_PUBLIC_TRUST_REGISTRY_ADDRESS as `0x${string}`) ?? "0x0";

interface RouteEntry {
  id: string;
  tokenId: string;
  ipfsCid: string;
  originName: string;
  destName: string;
  tags: string[];
  createdAt: string;
  aiSynthesis?: string;
}

export default function PassportDashboard() {
  const { address, isConnected } = useAccount();
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: reputation } = useReadContract({
    address: TRUST_REGISTRY,
    abi: TrustRegistryABI,
    functionName: "getReputation",
    args: [address],
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/routes/index?wallet=${address}`)
      .then((r) => r.json())
      .then((d) => setRoutes(d.routes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#8a8a8a] text-sm">
        <p className="text-3xl mb-3">🗺️</p>
        <p>Conectá tu wallet para ver tu Pasaporte.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Mi Pasaporte</h1>
          <p className="text-sm text-[#5c5c5c] font-mono mt-0.5">
            {address?.slice(0, 8)}…{address?.slice(-6)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[#8B7355]">
            {reputation !== undefined ? String(reputation) : "—"}
          </div>
          <div className="text-xs text-[#5c5c5c]">Trust Stamps</div>
        </div>
      </div>

      {/* Routes */}
      <div>
        <h2 className="text-sm font-semibold text-[#1a1a1a] mb-3">
          Rutas minteadas
        </h2>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-[#E8E8E8] animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && routes.length === 0 && (
          <div className="py-12 text-center text-sm text-[#8a8a8a]">
            <p className="text-3xl mb-2">🌱</p>
            Todavía no minteaste ninguna ruta.
          </div>
        )}

        <div className="space-y-3">
          {routes.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-xl bg-white border border-[#E8E8E8] space-y-2"
              style={{
                boxShadow: "rgba(0,0,0,0.06) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 4px",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[#1a1a1a] text-sm">
                    {r.originName} → {r.destName}
                  </p>
                  <p className="text-xs text-[#5c5c5c] mt-0.5">
                    {new Date(r.createdAt).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <a
                  href={ipfsUrl(r.ipfsCid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-[#8B7355] hover:underline shrink-0"
                >
                  IPFS
                </a>
              </div>
              {r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-[#f5f0e8] text-[#8B7355] text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {r.aiSynthesis && (
                <p className="text-xs text-[#5c5c5c] leading-relaxed line-clamp-2">
                  {r.aiSynthesis}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
