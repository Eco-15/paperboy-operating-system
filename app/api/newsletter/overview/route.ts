import { NextResponse } from "next/server";
import { getPublication, listPosts, sendEnabled } from "@/lib/beehiiv/client";
import { newsletterGate, beehiivErrorResponse } from "@/lib/newsletter/guard";
import { mapPost, type NlOverview } from "@/lib/newsletter/types";

export async function GET() {
  const gate = await newsletterGate();
  if (gate) return gate;
  try {
    const [pubRes, postsRes] = await Promise.all([getPublication(), listPosts({ limit: 6 })]);
    const p = pubRes.data;
    const overview: NlOverview = {
      publication: {
        name: p.name,
        activeSubscribers: p.stats?.active_subscriptions ?? 0,
        averageOpenRate: p.stats?.average_open_rate,
        totalSent: p.stats?.total_sent,
      },
      recentPosts: (postsRes.data ?? []).map(mapPost),
      sendEnabled: sendEnabled(),
    };
    return NextResponse.json(overview);
  } catch (e) {
    return beehiivErrorResponse(e);
  }
}
