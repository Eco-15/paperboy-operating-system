import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pokerPlayers } from "@/lib/db/schema";

const schema = z.object({
  name: z.string().min(1),
  company: z.string().default(""),
});

// Add a custom player. Any signed-in user may add. 409 if the name exists.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await db.select().from(pokerPlayers);
  if (
    existing.some(
      (p) => p.name.toLowerCase() === parsed.data.name.toLowerCase(),
    )
  ) {
    return NextResponse.json({ error: "Player already exists" }, { status: 409 });
  }

  await db
    .insert(pokerPlayers)
    .values({
      name: parsed.data.name,
      company: parsed.data.company,
      isCustom: true,
    });

  return NextResponse.json({ ok: true }, { status: 201 });
}
