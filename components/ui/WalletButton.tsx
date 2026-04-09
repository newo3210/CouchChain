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
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#e7e5e4] bg-[#fafaf9] hover:bg-[#f1f5f9] text-sm text-[#0f172a] transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-[#0d9488]" />
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];

  return (
    <button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isPending}
      className="px-3 py-1.5 rounded-full bg-[#1e293b] text-[#fafaf9] text-sm font-medium hover:bg-[#0f172a] transition-colors disabled:opacity-50"
    >
      {isPending ? "Conectando…" : "Conectar wallet"}
    </button>
  );
}
