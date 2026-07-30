import { z } from "zod";
import { db } from "@/lib/db";
import { subscribers } from "@/lib/db/schema";
import type { ActionHandler } from "../../types";

const schema = z.object({ email: z.string().email() });

export const addSubscriber: ActionHandler = async (params) => {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Invalid email" };
  const email = parsed.data.email.toLowerCase();

  await db.insert(subscribers).values({ email }).onConflictDoNothing();

  // Best-effort Beehiiv sync
  try {
    const { isConfigured, createSubscription } = await import("@/lib/beehiiv/client");
    if (isConfigured()) {
      await createSubscription(email, { reactivate: true, utmSource: "paperboy-site" });
    }
  } catch {
    /* Beehiiv sync is best-effort */
  }

  return {
    ok: true,
    data: { email },
    edits: [{ objectType: "Subscriber", objectId: email, operation: "create" }],
  };
};
