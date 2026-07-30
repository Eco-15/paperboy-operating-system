import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listSegments,
  listCustomFields,
  listAutomations,
  recalcSegment,
  enrollInAutomation,
  type BhList,
  type BhSegment,
  type BhCustomField,
  type BhAutomation,
} from "@/lib/beehiiv/client";
import { newsletterGate, beehiivErrorResponse } from "@/lib/newsletter/guard";
import { mapSegment, mapCustomField, mapAutomation } from "@/lib/newsletter/types";

function empty<T>(): BhList<T> {
  return { data: [] };
}

export async function GET() {
  const gate = await newsletterGate();
  if (gate) return gate;
  try {
    // Each list may require a different scope; degrade individually so one
    // missing scope doesn't blank the whole tab.
    const [seg, cf, au] = await Promise.all([
      listSegments().catch(() => empty<BhSegment>()),
      listCustomFields().catch(() => empty<BhCustomField>()),
      listAutomations().catch(() => empty<BhAutomation>()),
    ]);
    return NextResponse.json({
      segments: (seg.data ?? []).map(mapSegment),
      customFields: (cf.data ?? []).map(mapCustomField),
      automations: (au.data ?? []).map(mapAutomation),
    });
  } catch (e) {
    return beehiivErrorResponse(e);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("recalc"), segmentId: z.string().min(1) }),
  z.object({ action: z.literal("enroll"), automationId: z.string().min(1), email: z.string().email() }),
]);

export async function POST(req: Request) {
  const gate = await newsletterGate();
  if (gate) return gate;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    if (parsed.data.action === "recalc") await recalcSegment(parsed.data.segmentId);
    else await enrollInAutomation(parsed.data.automationId, parsed.data.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return beehiivErrorResponse(e);
  }
}
