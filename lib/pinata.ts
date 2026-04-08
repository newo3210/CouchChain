import { PinataSDK } from "pinata";
import { RouteIpfsPayload } from "./types/route";

let _pinata: PinataSDK | null = null;

function getPinata(): PinataSDK {
  if (!_pinata) {
    const jwt = process.env.PINATA_JWT;
    const gateway = process.env.PINATA_GATEWAY_URL ?? "gateway.pinata.cloud";
    if (!jwt) throw new Error("PINATA_JWT not set");
    _pinata = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway });
  }
  return _pinata;
}

export async function uploadRouteJson(
  payload: RouteIpfsPayload,
): Promise<string> {
  const pinata = getPinata();
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const file = new File([blob], "route.json");
  const result = await pinata.upload.public.file(file);
  return result.cid;
}

export function ipfsUrl(cid: string): string {
  const gateway = process.env.PINATA_GATEWAY_URL ?? "gateway.pinata.cloud";
  return `https://${gateway}/ipfs/${cid}`;
}
