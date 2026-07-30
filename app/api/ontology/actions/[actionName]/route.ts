import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { actionTypes } from "@/lib/ontology/actions";
import { executeAction } from "@/lib/ontology/actions/execute";
import { isStaff } from "@/lib/auth/guards";

// Ensure all handlers are registered on first import
import "@/lib/ontology/actions/register";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ actionName: string }> },
) {
  const session = await auth();
  const { actionName } = await params;

  const actionDef = actionTypes[actionName];
  if (!actionDef) {
    return NextResponse.json(
      { error: `Unknown action: ${actionName}`, available: Object.keys(actionTypes) },
      { status: 404 },
    );
  }

  // Pre-flight role gate (executeAction also checks, but fail fast with proper HTTP status)
  if (actionDef.requiredRole === "admin" && session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (actionDef.requiredRole === "internal" && !isStaff(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (actionDef.requiredRole === "any" && !session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // "public" actions don't require auth

  const body = await req.json().catch(() => ({}));
  const result = await executeAction(actionName, body, { session });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
