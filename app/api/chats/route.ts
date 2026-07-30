import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chats, chatMessages } from "@/lib/db/schema";
import type { Chat, MessagePart } from "@/lib/chat/types";

// List the signed-in user's chats, each with its messages (Chat[] shape).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, session.user.id))
    .orderBy(desc(chats.updatedAt));

  const ids = rows.map((r) => r.id);
  const msgs = ids.length
    ? await db
        .select()
        .from(chatMessages)
        .where(inArray(chatMessages.chatId, ids))
        .orderBy(chatMessages.createdAt)
    : [];

  const result: Chat[] = rows.map((c) => ({
    id: c.id,
    title: c.title,
    updated: c.updatedAt.toISOString(),
    messages: msgs
      .filter((m) => m.chatId === c.id)
      .map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        ts: m.createdAt.toISOString(),
        citations: m.citations ?? undefined,
        // The agent trace (tool calls, reasoning, proposals, files) — without this
        // the whole timeline vanished on reload.
        parts: (m.parts as MessagePart[] | null) ?? undefined,
      })),
  }));

  return NextResponse.json({ chats: result });
}

// Create a new (empty) chat. Returns it in Chat shape.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 48) : "New chat";

  const [row] = await db
    .insert(chats)
    .values({ userId: session.user.id, title })
    .returning();

  const chat: Chat = {
    id: row.id,
    title: row.title,
    updated: row.updatedAt.toISOString(),
    messages: [],
  };
  return NextResponse.json({ chat }, { status: 201 });
}
