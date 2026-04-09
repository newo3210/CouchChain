import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMultiStopRoute } from "@/lib/osrm";
import type { NamedCoord } from "@/lib/types/route";

const Body = z.object({
  waypoints: z
    .array(
      z.object({
        name: z.string(),
        lat: z.number(),
        lng: z.number(),
      }),
    )
    .min(2),
});

/** Recalcula tramos OSRM para una cadena de waypoints (p. ej. tras agregar parada). */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const coords: NamedCoord[] = parsed.data.waypoints.map((w) => ({
    name: w.name,
    lat: w.lat,
    lng: w.lng,
  }));
  const result = await getMultiStopRoute(coords);
  if (!result) {
    return NextResponse.json({ error: "Routing failed" }, { status: 502 });
  }
  return NextResponse.json({ segments: result.segments });
}
