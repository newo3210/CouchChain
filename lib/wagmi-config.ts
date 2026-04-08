"use client";
import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, metaMask } from "wagmi/connectors";

export const etherlinkTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ETHERLINK_CHAIN_ID ?? 128123),
  name: "Etherlink Shadownet Testnet",
  nativeCurrency: { name: "Tez", symbol: "XTZ", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ETHERLINK_RPC_URL ??
          "https://node.shadownet.etherlink.com",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherlink Explorer",
      url: "https://shadownet.explorer.etherlink.com",
    },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [etherlinkTestnet],
  connectors: [injected(), metaMask()],
  transports: {
    [etherlinkTestnet.id]: http(),
  },
  ssr: true,
});
