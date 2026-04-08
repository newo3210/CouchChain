import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  travelerWallet: z.string().min(10),
  hostWallet: z.string().min(10),
  templateType: z.enum(["stay", "availability", "exchange"]),
  note: z.string().max(140).optional(),
  routeId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const contact = await db.contactRequest.create({ data: parsed.data });

  // Optional: send email notification here using Resend/SendGrid
  // await sendHostNotification(contact);

  return NextResponse.json({ id: contact.id, status: contact.status });
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();
  const validStatuses = ["available", "unavailable", "ask_more"];
  if (!id || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const updated = await db.contactRequest.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
