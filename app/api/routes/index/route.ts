import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { creatorWallet, ipfsCid, aiSynthesis, tags, originName, destName } = body;

  if (!creatorWallet || !ipfsCid) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const route = await db.routeIndex.create({
      data: {
        creatorWallet,
        tokenId: body.txHash ?? "pending",
        ipfsCid,
        aiSynthesis: aiSynthesis ?? null,
        tags: tags ?? [],
        originName: originName ?? "",
        destName: destName ?? "",
      },
    });
    return NextResponse.json({ id: route.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet param required" }, { status: 400 });

  const routes = await db.routeIndex.findMany({
    where: { creatorWallet: wallet },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ routes });
}
