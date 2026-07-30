import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brandApps, inquiries } from "@/lib/db/schema";
import { brandAppToDeal, inquiryToDeal } from "@/lib/crm/map";
import { ALL_STATUSES, FUNDS } from "@/lib/crm/stages";
import type { ActionHandler } from "../../types";

const schema = z.object({
  dealId: z.string().min(1),
  origin: z.enum(["app", "form"]),
  stage: z.enum(ALL_STATUSES as [string, ...string[]]).optional(),
  priority: z.coerce.number().int().min(1).max(6).nullable().optional(),
  fund: z.enum(FUNDS as [string, ...string[]]).nullable().optional(),
  archived: z.boolean().optional(),
  message: z.string().max(5000).nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  subcategory: z.string().max(120).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(200).nullable().optional().or(z.literal("")),
  website: z.string().max(500).nullable().optional(),
});

function clean(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export const updateDeal: ActionHandler = async (params) => {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const d = parsed.data;

  if (d.origin === "form") {
    const set: Partial<typeof inquiries.$inferInsert> = {};
    if (d.stage !== undefined) set.stage = d.stage;
    if (d.fund !== undefined) set.fund = d.fund;
    if (d.archived !== undefined) set.archived = d.archived;
    if (d.message !== undefined) set.message = clean(d.message);
    if (Object.keys(set).length === 0) {
      return { ok: false, error: "Nothing to update" };
    }
    const [row] = await db
      .update(inquiries)
      .set(set)
      .where(eq(inquiries.id, d.dealId))
      .returning();
    if (!row) return { ok: false, error: "Not found" };
    return {
      ok: true,
      data: { deal: inquiryToDeal(row) },
      edits: [{ objectType: "Deal", objectId: d.dealId, operation: "update" }],
    };
  }

  const set: Partial<typeof brandApps.$inferInsert> = {};
  if (d.stage !== undefined) set.stage = d.stage;
  if (d.priority !== undefined) set.priority = d.priority;
  if (d.fund !== undefined) set.fund = d.fund;
  if (d.archived !== undefined) set.archived = d.archived;
  if (d.message !== undefined) set.message = clean(d.message);
  if (d.category !== undefined) set.category = clean(d.category);
  if (d.subcategory !== undefined) set.subcategory = clean(d.subcategory);
  if (d.contactName !== undefined) set.contactName = clean(d.contactName);
  if (d.contactEmail !== undefined) set.contactEmail = clean(d.contactEmail);
  if (d.website !== undefined) set.website = clean(d.website);
  if (Object.keys(set).length === 0) {
    return { ok: false, error: "Nothing to update" };
  }
  const [row] = await db
    .update(brandApps)
    .set(set)
    .where(eq(brandApps.id, d.dealId))
    .returning();
  if (!row) return { ok: false, error: "Not found" };
  return {
    ok: true,
    data: { deal: brandAppToDeal(row) },
    edits: [{ objectType: "Deal", objectId: d.dealId, operation: "update" }],
  };
};
