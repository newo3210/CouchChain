"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#8B7355]/30 bg-[#FAFAFA] hover:bg-[#f0ebe3] text-sm text-[#1a1a1a] transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-[#6B8E6B]" />
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];

  return (
    <button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isPending}
      className="px-3 py-1.5 rounded-lg bg-[#8B7355] text-white text-sm font-medium hover:bg-[#7a6549] transition-colors disabled:opacity-50"
    >
      {isPending ? "Conectando…" : "Conectar wallet"}
    </button>
  );
}
