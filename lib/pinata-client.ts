// Client-safe helper (no secrets, just URL building)
export function ipfsUrl(cid: string): string {
  const gateway =
    process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL ?? "gateway.pinata.cloud";
  return `https://${gateway}/ipfs/${cid}`;
}
