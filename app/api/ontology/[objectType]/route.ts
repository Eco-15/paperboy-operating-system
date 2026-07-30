import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { registry } from "@/lib/ontology/registry";
import { queryObjects } from "@/lib/ontology/query";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ objectType: string }> },
) {
  const session = await auth();
  const { objectType } = await params;

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

  // Parse query params: ?filter[stage]=New&filter[type]=VC&sort=-createdAt&limit=25&offset=0
  const url = new URL(req.url);
  const filters: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    const match = key.match(/^filter\[(.+)]$/);
    if (match) filters[match[1]] = value;
  }

  // Also support flat filters: ?stage=New&type=VC (convenience for the AI agent)
  const reserved = ["search", "sort", "limit", "offset", "include"];
  for (const [key, value] of url.searchParams) {
    if (!key.startsWith("filter[") && !reserved.includes(key)) {
      if (typeDef.properties[key]) filters[key] = value;
    }
  }

  const search = url.searchParams.get("search");
  const sort = url.searchParams.get("sort");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 500);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);
  const include = url.searchParams.get("include")?.split(",").filter(Boolean) ?? [];

  try {
    const result = await queryObjects(typeDef, {
      filters,
      search,
      sort,
      limit,
      offset,
      include,
      session,
    });
    return NextResponse.json(result);
  } catch (err) {
    // An unknown property/sort is now a hard error rather than a silently dropped
    // clause — surface it as a 400 so the caller can fix the query.
    if ((err as Error).name === "OntologyQueryError") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    throw err;
  }
}
