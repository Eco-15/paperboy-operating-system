import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { functions } from "@/lib/ontology/functions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await params;
  const fn = functions[name];
  if (!fn) {
    return NextResponse.json(
      { error: `Unknown function: ${name}`, available: Object.keys(functions) },
      { status: 404 },
    );
  }

  const result = await fn.compute();
  return NextResponse.json({ function: name, result });
}
