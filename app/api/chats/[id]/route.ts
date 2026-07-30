import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";

const patchSchema = z.object({ title: z.string().min(1).max(80) });

// Rename a chat (owner only).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id } = await params;
  const [row] = await db
    .update(chats)
    .set({ title: parsed.data.title.trim(), updatedAt: new Date() })
    .where(and(eq(chats.id, id), eq(chats.userId, session.user.id)))
    .returning({ id: chats.id, title: chats.title });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, chat: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db
    .delete(chats)
    .where(and(eq(chats.id, id), eq(chats.userId, session.user.id)));
  return NextResponse.json({ ok: true });
}
