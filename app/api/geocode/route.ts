import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { geocode } from "@/lib/photon";

const Q = z.object({
  q: z.string().min(1).max(200),
});

/** Geocodificación ligera para añadir paradas desde la UI (Photon). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const parsed = Q.safeParse({ q });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetro q inválido" }, { status: 400 });
  }
  const coord = await geocode(parsed.data.q);
  if (!coord) {
    return NextResponse.json({ error: "Sin resultados" }, { status: 404 });
  }
  return NextResponse.json({
    name: coord.name,
    lat: coord.lat,
    lng: coord.lng,
  });
}
