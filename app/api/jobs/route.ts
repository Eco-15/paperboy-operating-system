import { z } from "zod";
import { db } from "@/lib/db";
import { jobSubmissions } from "@/lib/db/schema";
import {
  email,
  shortText,
  isHoneypotTripped,
  readJson,
  ok,
  badRequest,
} from "@/lib/site/forms";

// Companies submitting a role for the curated CPG jobs board (/jobs).

const schema = z.object({
  company: shortText,
  contactEmail: email,
  roleTitle: shortText,
  link: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return badRequest("Invalid request");
  if (isHoneypotTripped(body)) return ok();

  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const j = parsed.data;

  await db.insert(jobSubmissions).values({
    company: j.company,
    contactEmail: j.contactEmail,
    roleTitle: j.roleTitle,
    link: j.link || null,
    notes: j.notes || null,
  });

  return ok();
}
