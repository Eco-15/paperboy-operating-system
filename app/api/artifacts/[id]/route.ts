import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { artifacts } from "@/lib/db/schema";
import { getArtifact, saveArtifact, restoreVersion } from "@/lib/artifacts/store";

const patchSchema = z.object({
  content: z.string().optional(),
  title: z.string().min(1).optional(),
  /** Roll back to an earlier version (as a new version — nothing is destroyed). */
  restoreVersion: z.number().int().positive().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const current = await getArtifact(id, session.user.id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.restoreVersion !== undefined) {
    const restored = await restoreVersion(id, session.user.id, parsed.data.restoreVersion);
    if (!restored) return NextResponse.json({ error: "No such version" }, { status: 404 });
    return NextResponse.json({ artifact: restored });
  }

  // A user edit is authored by the user — that's what makes it recoverable if the
  // model later overwrites it.
  const artifact = await saveArtifact({
    id,
    userId: session.user.id,
    chatId: current.chatId,
    title: parsed.data.title ?? current.title,
    kind: current.kind,
    content: parsed.data.content ?? current.content,
    authoredBy: "user",
  });

  return NextResponse.json({ artifact });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // Owner-scoped: deleting by id alone would let anyone remove another user's document.
  const res = await db
    .delete(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.userId, session.user.id)))
    .returning({ id: artifacts.id });

  if (!res.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
