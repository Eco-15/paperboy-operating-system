import { NextResponse } from "next/server";
import { z } from "zod";
import { listSubscriptions, createSubscription } from "@/lib/beehiiv/client";
import { newsletterGate, beehiivErrorResponse } from "@/lib/newsletter/guard";
import { mapSubscriber } from "@/lib/newsletter/types";

export async function GET(req: Request) {
  const gate = await newsletterGate();
  if (gate) return gate;
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || undefined;
  const page = Number(url.searchParams.get("page") || "1");
  try {
    const res = await listSubscriptions({ email, page, limit: 50 });
    return NextResponse.json({
      subscribers: (res.data ?? []).map(mapSubscriber),
      total: res.total_results ?? res.data?.length ?? 0,
      page: res.page ?? page,
      totalPages: res.total_pages ?? 1,
    });
  } catch (e) {
    return beehiivErrorResponse(e);
  }
}

const addSchema = z.object({
  email: z.string().email(),
  sendWelcome: z.boolean().optional(),
});

export async function POST(req: Request) {
  const gate = await newsletterGate();
  if (gate) return gate;
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  try {
    const res = await createSubscription(parsed.data.email, {
      sendWelcome: parsed.data.sendWelcome,
      reactivate: true,
    });
    return NextResponse.json({ subscriber: mapSubscriber(res.data) }, { status: 201 });
  } catch (e) {
    return beehiivErrorResponse(e);
  }
}
