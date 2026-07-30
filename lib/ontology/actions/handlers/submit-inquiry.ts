import { z } from "zod";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import type { ActionHandler } from "../../types";

const schema = z.object({
  type: z.enum(["investor", "founder", "contact"]),
  firstName: z.string().min(1).max(120),
  lastName: z.string().max(120).optional(),
  email: z.string().email(),
  company: z.string().max(200).optional(),
  position: z.string().max(200).optional(),
  accredited: z.boolean().optional(),
  deckName: z.string().max(300).optional(),
  message: z.string().max(5000).optional(),
});

export const submitInquiry: ActionHandler = async (params) => {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Invalid submission" };
  const d = parsed.data;

  const [row] = await db
    .insert(inquiries)
    .values({
      type: d.type,
      firstName: d.firstName.trim(),
      lastName: d.lastName?.trim() || null,
      email: d.email.trim().toLowerCase(),
      company: d.company?.trim() || null,
      position: d.position?.trim() || null,
      accredited: d.accredited ?? null,
      deckName: d.deckName?.trim() || null,
      message: d.message?.trim() || null,
    })
    .returning();

  return {
    ok: true,
    data: { id: row.id },
    edits: [
      { objectType: "Contact", objectId: row.id, operation: "create" },
      { objectType: "Deal", objectId: row.id, operation: "create" },
    ],
  };
};
