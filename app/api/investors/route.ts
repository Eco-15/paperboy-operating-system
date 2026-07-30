import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { investors } from "@/lib/db/schema";
import type { Investor } from "@/lib/investors/types";

// Returns the investor list in the shape the existing UI expects (legacy keys).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.select().from(investors);
  const mapped: Investor[] = rows.map((r) => ({
    Type: r.type as Investor["Type"],
    "Group Name": r.groupName,
    City: r.city ?? undefined,
    State: r.state ?? undefined,
    Website: r.website ?? undefined,
    LinkedIn: r.linkedin ?? undefined,
    Summary: r.summary ?? undefined,
  }));

  return NextResponse.json({ investors: mapped });
}
