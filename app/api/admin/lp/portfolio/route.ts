import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { portfolioCompanies } from "@/lib/db/schema";
import { staffApiUser } from "@/lib/auth/api";

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  highlight: z.string().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  status: z.enum(["active", "exited"]).default("active"),
  investedOn: z.string().optional(),
  sortOrder: z.number().int().default(0),
  visible: z.boolean().default(false),
});

// List all portfolio companies including hidden ones (staff only).
export async function GET() {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db
    .select()
    .from(portfolioCompanies)
    .orderBy(asc(portfolioCompanies.sortOrder), asc(portfolioCompanies.createdAt));
  return NextResponse.json({ companies: rows });
}

// Add a portfolio company (staff only). Hidden until `visible` is flipped on.
export async function POST(req: Request) {
  const user = await staffApiUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const [row] = await db.insert(portfolioCompanies).values(parsed.data).returning();
  return NextResponse.json({ company: row }, { status: 201 });
}
