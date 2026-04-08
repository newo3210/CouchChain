import { NextRequest, NextResponse } from "next/server";
import { uploadRouteJson } from "@/lib/pinata";
import { RouteIpfsPayload } from "@/lib/types/route";

export async function POST(req: NextRequest) {
  const { payload } = (await req.json()) as { payload: RouteIpfsPayload };
  if (!payload) return NextResponse.json({ error: "Missing payload" }, { status: 400 });

  try {
    const cid = await uploadRouteJson(payload);
    return NextResponse.json({ cid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
