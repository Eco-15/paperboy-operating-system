import { z } from "zod";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import {
  email,
  shortText,
  longText,
  isHoneypotTripped,
  readJson,
  ok,
  badRequest,
} from "@/lib/site/forms";

// Founder applications from the public /apply page. Rows land in `inquiries`
// with type "founder", so they surface in the CRM pipeline alongside the
// historical brand_app imports — no separate inbox to forget about.

const schema = z.object({
  firstName: shortText,
  lastName: z.string().trim().max(200).optional().default(""),
  email,
  brand: shortText,
  website: z.string().trim().max(300).optional().default(""),
  raising: z.string().trim().max(300).optional().default(""),
  interest: z.enum(["feature", "investment", "both"]),
  pitch: longText,
});

const INTEREST_LABEL: Record<string, string> = {
  feature: "Content feature",
  investment: "Direct investment (Fund I)",
  both: "Content feature + direct investment",
};

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return badRequest("Invalid request");
  if (isHoneypotTripped(body)) return ok();

  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const a = parsed.data;

  // Structured header keeps website/raise/interest visible in the CRM's
  // message field without widening the inquiries schema.
  const header = [
    `Interest: ${INTEREST_LABEL[a.interest]}`,
    a.website ? `Website: ${a.website}` : null,
    a.raising ? `Raising: ${a.raising}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await db.insert(inquiries).values({
    type: "founder",
    firstName: a.firstName,
    lastName: a.lastName || null,
    email: a.email,
    company: a.brand,
    message: `${header}\n\n${a.pitch}`,
  });

  return ok();
}
