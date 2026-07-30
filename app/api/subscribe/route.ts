import { z } from "zod";
import { db } from "@/lib/db";
import { subscribers } from "@/lib/db/schema";
import { createSubscription, isConfigured } from "@/lib/beehiiv/client";
import {
  email,
  isHoneypotTripped,
  readJson,
  ok,
  badRequest,
} from "@/lib/site/forms";

// Public list signups: DEALS newsletter, the weekly CPG jobs digest, and the
// talent network. Every signup lands in the local `subscriber` table
// (idempotent per email+list); DEALS additionally pushes to Beehiiv — the
// list Kyle actually sends from — when the integration is configured.

const schema = z.object({
  email,
  list: z.enum(["deals", "jobs", "talent"]),
  name: z.string().trim().max(200).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
});

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return badRequest("Invalid request");
  if (isHoneypotTripped(body)) return ok();

  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const s = parsed.data;

  await db
    .insert(subscribers)
    .values({
      email: s.email.toLowerCase(),
      list: s.list,
      name: s.name || null,
      note: s.note || null,
    })
    .onConflictDoNothing();

  if (s.list === "deals" && isConfigured()) {
    // Best-effort: the local row is the source of truth for the signup; a
    // Beehiiv hiccup shouldn't turn a successful subscribe into an error.
    try {
      await createSubscription(s.email, { reactivate: true });
    } catch {
      /* recorded locally; staff can re-sync from the newsletter tool */
    }
  }

  return ok();
}
