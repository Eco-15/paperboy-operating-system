import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { buildNews, saveNews, todayEdition } from "@/lib/news/build-news";

// Regenerate the dashboard news feed. Two callers:
//  • Cloud Scheduler cron — sends the shared secret in `x-news-secret`.
//  • A staff member — manual trigger via an authenticated session.
// Mirrors app/api/admin/drive/sync (the drive-ingest manual trigger).
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = req.headers.get("x-news-secret");
  const expected = process.env.NEWS_REFRESH_SECRET;
  const viaCron = !!expected && secret === expected;

  if (!viaCron) {
    const session = await auth();
    if (!session?.user || !isStaff(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const edition = todayEdition();
  const items = await buildNews(edition);
  if (items.length > 0) {
    await saveNews(items, crypto.randomUUID(), edition);
  }
  return NextResponse.json({ ok: true, edition, count: items.length });
}
