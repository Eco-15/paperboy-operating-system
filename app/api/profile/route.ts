import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getUserProfile } from "@/lib/profile/store";

// Edit your own display name / photo. Role and email are NOT editable here —
// email is the auth identity, and role changes are an admin concern.

const MAX_NAME = 80;

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { name?: unknown; image?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: { name?: string | null; image?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    if (name.length > MAX_NAME) {
      return NextResponse.json({ error: `Name must be ${MAX_NAME} characters or fewer` }, { status: 400 });
    }
    patch.name = name;
  }

  if (body.image === null || body.image === "") {
    patch.image = null; // fall back to initials
  } else if (typeof body.image === "string") {
    const url = body.image.trim();
    // Only allow http(s) URLs — no data:/javascript: smuggled into an <img src>.
    if (!/^https:\/\/|^http:\/\//i.test(url)) {
      return NextResponse.json({ error: "Photo must be an http(s) URL" }, { status: 400 });
    }
    patch.image = url;
  }

  if (patch.name === undefined && patch.image === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(users).set(patch).where(eq(users.id, userId));
  return NextResponse.json(await getUserProfile(userId));
}
