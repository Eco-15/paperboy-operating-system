import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { portalUpdates } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";

const createSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  publish: z.boolean().default(false),
});

// List all updates including drafts (staff only).
export async function GET() {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db
    .select()
    .from(portalUpdates)
    .orderBy(desc(portalUpdates.createdAt));
  return NextResponse.json({ updates: rows });
}

// Create an update, optionally publishing immediately (staff only).
export async function POST(req: Request) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const [row] = await db
    .insert(portalUpdates)
    .values({
      authorId: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      status: parsed.data.publish ? "published" : "draft",
      publishedAt: parsed.data.publish ? new Date() : null,
    })
    .returning();
  return NextResponse.json({ update: row }, { status: 201 });
}
