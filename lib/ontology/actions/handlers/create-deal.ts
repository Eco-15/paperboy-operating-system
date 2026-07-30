import { z } from "zod";
import { db } from "@/lib/db";
import { brandApps } from "@/lib/db/schema";
import { brandAppToDeal } from "@/lib/crm/map";
import { ASSIGNABLE_STAGES, FUNDS } from "@/lib/crm/stages";
import type { ActionHandler } from "../../types";

const schema = z.object({
  company: z.string().min(1).max(200),
  category: z.string().max(120).optional(),
  subcategory: z.string().max(120).optional(),
  stage: z.enum(ASSIGNABLE_STAGES as [string, ...string[]]).optional(),
  priority: z.coerce.number().int().min(1).max(6).optional(),
  fund: z.enum(FUNDS as [string, ...string[]]).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().max(200).optional().or(z.literal("")),
  website: z.string().max(500).optional(),
  message: z.string().max(5000).optional(),
  pitchdeckLink: z.string().max(500).optional(),
});

export const createDeal: ActionHandler = async (params) => {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const d = parsed.data;

  const [row] = await db
    .insert(brandApps)
    .values({
      company: d.company.trim(),
      category: d.category?.trim() || null,
      subcategory: d.subcategory?.trim() || null,
      source: "Added in-app",
      priority: d.priority ?? null,
      stage: d.stage || "New",
      fund: d.fund ?? null,
      contactName: d.contactName?.trim() || null,
      contactEmail: d.contactEmail?.trim() || null,
      message: d.message?.trim() || null,
      website: d.website?.trim() || null,
      pitchdeckLink: d.pitchdeckLink?.trim() || null,
      dateSubmitted: new Date().toISOString(),
    })
    .returning();

  return {
    ok: true,
    data: { deal: brandAppToDeal(row) },
    edits: [{ objectType: "Deal", objectId: row.id, operation: "create" }],
  };
};
