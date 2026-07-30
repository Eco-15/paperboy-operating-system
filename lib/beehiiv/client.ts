// Server-side Beehiiv API client (v2). Lazy — reads env at call time, like the
// Anthropic client in lib/chat/providers.ts. The API key never leaves the
// server. Endpoints are scoped under /publications/{publicationId}/...
//
// Endpoint paths follow the Beehiiv v2 REST API; confirm against the OpenAPI at
// https://api.beehiiv.com if a shape changes.

const BASE = "https://api.beehiiv.com/v2";

export function isConfigured(): boolean {
  return !!(process.env.BEEHIIV_API_KEY && process.env.BEEHIIV_PUBLICATION_ID);
}

/** Whether firing a real send is allowed (Beehiiv Send API is Enterprise/beta). */
export function sendEnabled(): boolean {
  return process.env.BEEHIIV_SEND_ENABLED === "true";
}

export class BeehiivError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Beehiiv API error ${status}`);
    this.name = "BeehiivError";
    this.status = status;
    this.body = body;
  }
}

function cfg(): { key: string; pub: string } {
  const key = process.env.BEEHIIV_API_KEY;
  const pub = process.env.BEEHIIV_PUBLICATION_ID;
  if (!key || !pub) throw new BeehiivError(503, { error: "beehiiv_not_configured" });
  return { key, pub };
}

async function bh<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const { key } = cfg();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) throw new BeehiivError(res.status, body);
  return body as T;
}

function pub(suffix: string): string {
  const { pub } = cfg();
  return `/publications/${pub}${suffix}`;
}

// ── Response shapes (only the fields we use) ────────────────────────────────
export interface BhList<T> {
  data: T[];
  total_results?: number;
  page?: number;
  total_pages?: number;
}
export interface BhSubscription {
  id: string;
  email: string;
  status: string;
  created: number; // unix seconds
  subscription_tier?: string;
  utm_source?: string | null;
}
export interface BhPostStats {
  email?: { recipients?: number; opens?: number; unique_opens?: number; clicks?: number; open_rate?: number; click_rate?: number };
  web?: { views?: number; clicks?: number };
}
export interface BhPost {
  id: string;
  title: string;
  subtitle?: string | null;
  status: string; // draft | confirmed | archived
  publish_date?: number | null;
  created?: number;
  web_url?: string | null;
  thumbnail_url?: string | null;
  content_tags?: string[];
  content?: { free?: { web?: string; email?: string } };
  stats?: BhPostStats;
}
export interface BhPublication {
  id: string;
  name: string;
  stats?: { active_subscriptions?: number; active_premium_subscriptions?: number; total_sent?: number; average_open_rate?: number };
}
export interface BhCustomField { id: string; display: string; kind: string }
export interface BhSegment { id: string; name: string; type?: string; status?: string; total_results?: number }
export interface BhAutomation { id: string; name: string; status?: string; description?: string }

// ── Subscriptions ───────────────────────────────────────────────────────────
export function createSubscription(
  email: string,
  opts: { sendWelcome?: boolean; reactivate?: boolean; utmSource?: string } = {},
) {
  return bh<{ data: BhSubscription }>(pub("/subscriptions"), {
    method: "POST",
    body: JSON.stringify({
      email,
      reactivate_existing: opts.reactivate ?? false,
      send_welcome_email: opts.sendWelcome ?? false,
      utm_source: opts.utmSource ?? "paperboy-os",
    }),
  });
}
export function listSubscriptions(params: { email?: string; limit?: number; page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.email) q.set("email", params.email);
  q.set("limit", String(params.limit ?? 50));
  q.set("page", String(params.page ?? 1));
  q.set("order_by", "created");
  q.set("direction", "desc");
  return bh<BhList<BhSubscription>>(pub(`/subscriptions?${q.toString()}`));
}

// ── Posts ───────────────────────────────────────────────────────────────────
export function listPosts(params: { limit?: number; page?: number; status?: string } = {}) {
  const q = new URLSearchParams();
  q.set("limit", String(params.limit ?? 25));
  q.set("page", String(params.page ?? 1));
  q.append("expand[]", "free_web_content");
  q.append("expand[]", "stats");
  if (params.status) q.set("status", params.status);
  q.set("order_by", "publish_date");
  q.set("direction", "desc");
  return bh<BhList<BhPost>>(pub(`/posts?${q.toString()}`));
}
export function getPost(id: string) {
  return bh<{ data: BhPost }>(pub(`/posts/${id}?expand[]=free_web_content&expand[]=stats`));
}
export function createPost(payload: Record<string, unknown>) {
  return bh<{ data: BhPost }>(pub("/posts"), { method: "POST", body: JSON.stringify(payload) });
}
export function testSendPost(id: string, emails: string[]) {
  return bh(pub(`/posts/${id}/test`), {
    method: "POST",
    body: JSON.stringify({ email_addresses: emails }),
  });
}

// ── Publication / segments / custom fields / automations ────────────────────
export function getPublication() {
  return bh<{ data: BhPublication }>(pub("?expand[]=stats"));
}
export function listCustomFields() {
  return bh<BhList<BhCustomField>>(pub("/custom_fields"));
}
export function listSegments() {
  return bh<BhList<BhSegment>>(pub("/segments"));
}
export function recalcSegment(id: string) {
  return bh(pub(`/segments/${id}/recalculate`), { method: "PUT" });
}
export function listAutomations() {
  return bh<BhList<BhAutomation>>(pub("/automations"));
}
export function enrollInAutomation(automationId: string, email: string) {
  return bh(pub(`/automations/${automationId}/journeys`), {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
