import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// This endpoint exists to help the frontend build the stamp parameters.
// The actual on-chain transaction is initiated from the client via wagmi.

const BodySchema = z.object({
  travelerWallet: z.string(),
  hostWallet: z.string(),
  routeId: z.string(),       // NFT tokenId as string
  geohash: z.string().max(12),
  comment: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { travelerWallet, hostWallet, routeId, geohash, comment } = parsed.data;

  // If there's a comment, upload it to IPFS
  let commentCid = "";
  if (comment) {
    try {
      const { uploadRouteJson } = await import("@/lib/pinata");
      // Reuse uploadRouteJson with a comment object (minor type cast)
      // In production, use a dedicated comment uploader
      const commentPayload = {
        version: "1.0" as const,
        created_at: new Date().toISOString(),
        creator: travelerWallet,
        route_data: {
          origin: { name: "", lat: 0, lng: 0 },
          destination: { name: "", lat: 0, lng: 0 },
          waypoints: [],
          transport_segments: [],
          estimated_budget: { currency: "ARS", amount: 0 },
        },
        metadata: {
          tags: ["trust-stamp-comment"],
          photos: [],
          ai_synthesis: comment,
        },
      };
      commentCid = await uploadRouteJson(commentPayload);
    } catch {
      // Non-blocking: comment upload failure shouldn't prevent stamp issuance
    }
  }

  return NextResponse.json({
    hostWallet,
    routeId: BigInt(routeId).toString(),
    geohash,
    commentCid,
    // The client calls TrustRegistry.issueStamp(host, routeId, geohash, commentCid) directly
  });
}
