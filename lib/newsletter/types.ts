// UI-facing shapes for the Newsletter module + mappers from the raw Beehiiv
// responses (lib/beehiiv/client.ts) to these shapes.
import type { BhPost, BhSubscription, BhSegment, BhCustomField, BhAutomation } from "@/lib/beehiiv/client";

export interface NlPublication {
  name: string;
  activeSubscribers: number;
  averageOpenRate?: number;
  totalSent?: number;
}
export interface NlPost {
  id: string;
  title: string;
  status: string;
  date: string;
  webUrl?: string;
  recipients?: number;
  openRate?: number;
  clickRate?: number;
  webViews?: number;
}
export interface NlSubscriber {
  id: string;
  email: string;
  status: string;
  created: string;
  utmSource?: string;
}
export interface NlSegment { id: string; name: string; type?: string; members?: number }
export interface NlCustomField { id: string; name: string; kind: string }
export interface NlAutomation { id: string; name: string; status?: string }

export interface NlOverview {
  publication: NlPublication;
  recentPosts: NlPost[];
  sendEnabled: boolean;
}

export function formatUnix(sec?: number | null): string {
  if (!sec) return "";
  return new Date(sec * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function mapPost(p: BhPost): NlPost {
  const email = p.stats?.email;
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    date: p.publish_date ? formatUnix(p.publish_date) : p.status === "draft" ? "Draft" : "",
    webUrl: p.web_url ?? undefined,
    recipients: email?.recipients,
    openRate: email?.open_rate,
    clickRate: email?.click_rate,
    webViews: p.stats?.web?.views,
  };
}

export function mapSubscriber(s: BhSubscription): NlSubscriber {
  return {
    id: s.id,
    email: s.email,
    status: s.status,
    created: formatUnix(s.created),
    utmSource: s.utm_source ?? undefined,
  };
}

export const mapSegment = (s: BhSegment): NlSegment => ({
  id: s.id,
  name: s.name,
  type: s.type,
  members: s.total_results,
});
export const mapCustomField = (f: BhCustomField): NlCustomField => ({
  id: f.id,
  name: f.display,
  kind: f.kind,
});
export const mapAutomation = (a: BhAutomation): NlAutomation => ({
  id: a.id,
  name: a.name,
  status: a.status,
});
