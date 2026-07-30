import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPokerState } from "@/lib/poker/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getPokerState());
}
