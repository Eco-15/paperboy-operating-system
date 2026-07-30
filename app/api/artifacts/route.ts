import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listArtifacts, getArtifact, listVersions } from "@/lib/artifacts/store";

// The Documents library. Everything is scoped to the signed-in user: artifact ids are
// model-chosen slugs like "fon-series-a-memo", so without owner-scoping a guessed id
// would read someone else's document.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const artifact = await getArtifact(id, session.user.id);
    if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const versions = await listVersions(id, session.user.id);
    return NextResponse.json({ artifact, versions });
  }

  return NextResponse.json({ artifacts: await listArtifacts(session.user.id) });
}
