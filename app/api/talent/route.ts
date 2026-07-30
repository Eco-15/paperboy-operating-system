import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscribers, talents } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import { talentToRec } from "@/lib/talent/map";
import { ASSIGNABLE_STAGES } from "@/lib/talent/stages";

// The Talent CRM is one roster in Cloud SQL (`talent`), fed two ways:
//  • people added in-app
//  • talent-network signups from the public /jobs page (subscriber rows with
//    list='talent'), lazily imported here by email on every list read — so a
//    fresh signup surfaces at the top of the board as "New" with no cron.

function ts(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const view = new URL(req.url).searchParams.get("view") === "archive"
    ? "archive"
    : "pipeline";

  const [rows, signups] = await Promise.all([
    db.select().from(talents),
    db.select().from(subscribers).where(eq(subscribers.list, "talent")),
  ]);

  // Import talent-network signups we haven't seen yet (matched by email).
  const have = new Set(
    rows.map((r) => (r.email ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const fresh = signups.filter(
    (s) => s.email.trim() && !have.has(s.email.trim().toLowerCase()),
  );
  if (fresh.length > 0) {
    const inserted = await db
      .insert(talents)
      .values(
        fresh.map((s) => ({
          name: s.name?.trim() || s.email.trim(),
          email: s.email.trim(),
          notes: s.note?.trim() || null,
          source: "Talent network signup",
          stage: "New",
          createdAt: s.createdAt,
        })),
      )
      .returning();
    rows.push(...inserted);
  }

  const all = rows.map(talentToRec).sort((a, b) => ts(b.date) - ts(a.date));
  const talent = all.filter((t) => t.archived === (view === "archive"));

  const newCount = talent.filter((t) => (t.stage ?? "New") === "New").length;
  const archivedCount = all.filter((t) => t.archived).length;
  return NextResponse.json({ talent, newCount, archivedCount });
}

// Add a person to the roster. Staff-only.
const createSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(120).optional(),
  company: z.string().max(200).optional(),
  stage: z.enum(ASSIGNABLE_STAGES as [string, ...string[]]).optional(),
  priority: z.coerce.number().int().min(1).max(6).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  link: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const [row] = await db
    .insert(talents)
    .values({
      name: d.name.trim(),
      role: d.role?.trim() || null,
      company: d.company?.trim() || null,
      source: "Added in-app",
      priority: d.priority ?? null,
      stage: d.stage || "New",
      email: d.email?.trim() || null,
      link: d.link?.trim() || null,
      location: d.location?.trim() || null,
      notes: d.notes?.trim() || null,
    })
    .returning();

  return NextResponse.json({ person: talentToRec(row) }, { status: 201 });
}
