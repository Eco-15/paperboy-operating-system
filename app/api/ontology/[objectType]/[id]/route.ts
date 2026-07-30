import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { registry } from "@/lib/ontology/registry";
import { getObjectById } from "@/lib/ontology/query";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ objectType: string; id: string }> },
) {
  const session = await auth();
  const { objectType, id } = await params;

  const typeDef = registry.objectTypes[objectType];
  if (!typeDef) {
    return NextResponse.json({ error: `Unknown object type: ${objectType}` }, { status: 404 });
  }

  // Role gate
  if (typeDef.readRole === "admin" && session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (typeDef.readRole === "internal" && !isStaff(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (typeDef.readRole !== "any" && !session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const object = await getObjectById(typeDef, id, { session });
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ objectType, object });
}
