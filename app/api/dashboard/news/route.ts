import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLatestEdition } from "@/lib/news/store";

// The dashboard news rail — the latest daily edition, ranked. Any signed-in
// user. The full paper (and the archive) lives at /news.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latest = await getLatestEdition();
  return NextResponse.json({
    edition: latest?.edition ?? null,
    news: (latest?.stories ?? []).slice(0, 12).map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      source: r.source,
      summary: r.summary,
      whyItMatters: r.whyItMatters,
      category: r.category,
    })),
  });
}
