import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  bigint,
  boolean,
  jsonb,
  doublePrecision,
  serial,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  vector,
  customType,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// Raw binary column (Postgres bytea) for archiving generated file bytes.
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

// ── Roles ─────────────────────────────────────────────────────────────────────
// admin    = full control (you)
// internal = staff: full operating system + Drive-grounded chat
// client   = invited outside users: limited view
// investor = LP with access to the investor portal (/portal) only
export const userRole = pgEnum("user_role", [
  "admin",
  "internal",
  "client",
  "investor",
]);

// ── Auth.js core tables (shape required by @auth/drizzle-adapter) ───────────────
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // app extensions
  role: userRole("role").notNull().default("client"),
  passwordHash: text("password_hash"), // invited clients only; staff use Google
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// ── Client invitations ──────────────────────────────────────────────────────
export const invites = pgTable("invite", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  role: userRole("role").notNull().default("client"),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Investors (seeded from lib/investors/data.ts, ~460 rows) ──────────────────
export const investors = pgTable("investor", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "Angel Group" | "VC" | "Family Office"
  groupName: text("group_name").notNull(),
  city: text("city"),
  state: text("state"),
  website: text("website"),
  linkedin: text("linkedin"),
  summary: text("summary"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
});

// ── Blog ("The Front Page") ───────────────────────────────────────────────────
// Draft/publish follows the site_page pattern: staff edits live ONLY in the
// `draft` jsonb; Publish copies it into the flat columns + status='published'.
// The public /press pages read flat columns of published rows, so mid-edit
// state is never visible. `slug` is nullable — legacy/seeded rows have none
// and can't surface publicly until first published (which assigns one).
export type BlogDraft = {
  title: string;
  category: string;
  slug: string;
  excerpt: string;
  displayDate: string;
  imageUrl: string;
  body: string; // markdown
};

export const blogPosts = pgTable("blog_post", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  authorId: text("author_id").references(() => users.id),
  title: text("title").notNull(),
  category: text("category").notNull(),
  slug: text("slug").unique(),
  excerpt: text("excerpt").notNull().default(""),
  displayDate: text("display_date"), // e.g. "3/10/26" — preserves the current UI format
  imageUrl: text("image_url").default(""),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  draft: jsonb("draft").$type<BlogDraft>(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Poker tournament ──────────────────────────────────────────────────────────
// Live tally for a player = base_votes (CSV import) + Σ(deltas in poker_vote).
export const pokerPlayers = pgTable("poker_player", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  baseVotes: integer("base_votes").notNull().default(0),
  isCustom: boolean("is_custom").notNull().default(false),
  isEliminated: boolean("is_eliminated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pokerVotes = pgTable("poker_vote", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  playerId: text("player_id")
    .notNull()
    .references(() => pokerPlayers.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  caster: text("caster").notNull().default(""),
  isTest: boolean("is_test").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Chat ("Ask Paperboy") ─────────────────────────────────────────────────────
export const chatRole = pgEnum("chat_role", ["user", "assistant"]);

export const chats = pgTable("chat", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New chat"),
  lastModel: text("last_model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: chatRole("role").notNull(),
  text: text("text").notNull(),
  model: text("model"),
  citations: jsonb("citations").$type<{ file: string; link: string | null }[]>(),
  // The ordered agent trace (text / thinking / tool calls + results / action
  // proposals / files). Without this the whole trace vanished on reload — the UI
  // could only re-render the flat `text`. Shape: lib/chat/types.ts MessagePart.
  parts: jsonb("parts").$type<unknown[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Files the agent generated (PowerPoint/Word/Excel/PDF) via Claude's document
// skills. Bytes are archived here so download links survive Anthropic's file
// retention; the download route enforces per-user ownership.
export const chatFiles = pgTable("chat_file", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  fileId: text("file_id").notNull().unique(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  messageId: text("message_id"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  bytes: bytea("bytes").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Marketing subscribers ─────────────────────────────────────────────────────
// One row per (email, list). `list` segments the public-site signups: the DEALS
// newsletter (also pushed to Beehiiv when configured), the weekly CPG jobs
// digest, and the talent network (which also captures name/note).
export const subscriberList = pgEnum("subscriber_list", ["deals", "jobs", "talent"]);

export const subscribers = pgTable(
  "subscriber",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    list: subscriberList("list").notNull().default("deals"),
    name: text("name"),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscriber_email_list_idx").on(t.email, t.list)],
);

// ── Job-board submissions ─────────────────────────────────────────────────────
// Companies submitting a role for the curated CPG jobs page (/jobs).
export const jobSubmissions = pgTable("job_submission", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  company: text("company").notNull(),
  contactEmail: text("contact_email").notNull(),
  roleTitle: text("role_title").notNull(),
  link: text("link"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Talent CRM ────────────────────────────────────────────────────────────────
// One row per person in the talent roster. `stage` is free-form text like the
// deal CRM (vocabulary lives in lib/talent/stages.ts). GET /api/talent lazily
// imports talent-network signups (subscriber rows with list='talent') by email.
export const talents = pgTable("talent", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  role: text("role"), // discipline / function, e.g. "Growth Marketing"
  company: text("company"), // current employer
  email: text("email"),
  link: text("link"), // LinkedIn / portfolio
  location: text("location"),
  source: text("source"),
  priority: integer("priority"),
  stage: text("stage"),
  notes: text("notes"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Marketing inquiries ───────────────────────────────────────────────────────
// Backs the public "Let's Connect" forms on /for-investors, /for-founders and
// /contact. `type` distinguishes the source; the optional columns are populated
// per variant (investor → accredited; founder → company/position/deckName).
export const inquiries = pgTable("inquiry", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(), // "investor" | "founder" | "contact"
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email").notNull(),
  company: text("company"),
  position: text("position"),
  accredited: boolean("accredited"),
  deckName: text("deck_name"), // captured filename only — see app/api/contact
  message: text("message"),
  stage: text("stage"), // CRM pipeline stage once triaged (null ⇒ shown as "New")
  fund: text("fund"), // "Fund I" | "Fund II" | null = unassigned (lib/crm/stages FUNDS)
  archived: boolean("archived").notNull().default(false), // out of the pipeline view
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Brand applications (Investment CRM pipeline) ──────────────────────────────
// Seeded (full-refresh) from the master DEALS brand-apps CSV. The CRM view unions
// these with live `inquiries` (website-form leads) so history + new inbound live
// in one place. Priority is 1–6 (6 = highest — the deals that closed).
export const brandApps = pgTable("brand_app", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  company: text("company").notNull(),
  category: text("category"),
  subcategory: text("subcategory"),
  source: text("source"),
  priority: integer("priority"),
  stage: text("stage"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  message: text("message"),
  pitchdeckLink: text("pitchdeck_link"),
  pitchdeckFile: text("pitchdeck_file"),
  website: text("website"),
  dateSubmitted: text("date_submitted"),
  aiOnePager: text("ai_one_pager"),
  fund: text("fund"), // "Fund I" | "Fund II" | null = unassigned (lib/crm/stages FUNDS)
  archived: boolean("archived").notNull().default(false), // historical/parked deals live in the Archive
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Daily CPG news editions ───────────────────────────────────────────────────
// Populated by the scheduled "news loop" (pure Exa.ai search — no LLM).
// Each run writes one dated edition ("YYYY-MM-DD", America/New_York);
// re-running a day replaces only that day's edition, past editions are the
// /news archive. The dashboard rail shows the latest edition.
export const newsItems = pgTable("news_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  edition: text("edition").notNull().default(""), // "YYYY-MM-DD"
  title: text("title").notNull(),
  url: text("url").notNull(),
  source: text("source"),
  summary: text("summary"),
  whyItMatters: text("why_it_matters"),
  category: text("category"),
  imageUrl: text("image_url"), // hero/og:image from Exa, hotlinked (may die with the article)
  rank: integer("rank").notNull().default(0),
  batchId: text("batch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Per-user Google connection (dashboard Calendar + Gmail) ───────────────────
// Each staff user connects THEIR OWN Google account via /api/google/connect;
// we store that user's refresh token here (keyed by userId) and read only their
// calendar/inbox. Separate from Auth.js sign-in, so login is unaffected.
export const googleCredentials = pgTable("google_credential", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email"),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  expiryDate: bigint("expiry_date", { mode: "number" }), // ms epoch
  scope: text("scope"),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});

// ── MCP connector OAuth (self-hosted authorization server) ────────────────────
// Backs the remote MCP server (app/api/mcp) that staff add as a custom connector
// in their own Claude. We are the OAuth 2.1 authorization server: clients register
// dynamically (RFC 7591), users authorize via the existing Google login, and we
// issue short-lived JWT access tokens (verified at /api/mcp). See lib/mcp/*.
export const mcpClients = pgTable("mcp_client", {
  clientId: text("client_id").primaryKey(),
  clientName: text("client_name"),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mcpAuthCodes = pgTable("mcp_auth_code", {
  code: text("code").primaryKey(),
  clientId: text("client_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(), // PKCE S256 challenge
  resource: text("resource"),
  scope: text("scope"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mcpRefreshTokens = pgTable("mcp_refresh_token", {
  tokenHash: text("token_hash").primaryKey(), // sha256 of the opaque refresh token
  clientId: text("client_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Drive-grounded knowledge base (Phase 3) ───────────────────────────────────
// `accessors` holds the principals (emails / group ids) allowed to open the file,
// captured from Drive at sync time. Retrieval filters chunks to files whose
// `accessors` include the signed-in staff member — this is what enforces
// "internal staff only, specific to what they have access to".
export const driveFiles = pgTable("drive_file", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  driveFileId: text("drive_file_id").notNull().unique(),
  name: text("name").notNull(),
  title: text("title"), // first non-empty line of the doc (fallback: name)
  mimeType: text("mime_type"),
  modifiedTime: timestamp("modified_time"),
  webLink: text("web_link"),
  accessors: jsonb("accessors").$type<string[]>().default(sql`'[]'::jsonb`),
  // Where this record came from: raw Drive ingest, or an LLM-synthesized card/
  // template (jobs/knowledge-builder). Lets retrieval label & lightly boost cards.
  source: text("source").default("drive_raw"),
  lastSyncedAt: timestamp("last_synced_at"),
});

export const docChunks = pgTable(
  "doc_chunk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    driveFileId: text("drive_file_id")
      .notNull()
      .references(() => driveFiles.driveFileId, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    // Vertex AI text-embedding-005 / gemini-embedding-001 (reduced) → 768 dims.
    embedding: vector("embedding", { dimensions: 768 }),
    tokenCount: integer("token_count"),
  },
  (t) => ({
    embeddingIdx: index("doc_chunk_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  }),
);

// ── Gmail messages (synced from Gmail API per user) ──────────────────────────
export const gmailMessages = pgTable("gmail_message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  gmailId: text("gmail_id").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  threadId: text("thread_id"),
  subject: text("subject"),
  from: text("from"),
  to: jsonb("to").$type<string[]>().default(sql`'[]'::jsonb`),
  cc: jsonb("cc").$type<string[]>().default(sql`'[]'::jsonb`),
  snippet: text("snippet"),
  isRead: boolean("is_read").notNull().default(false),
  labels: jsonb("labels").$type<string[]>().default(sql`'[]'::jsonb`),
  date: timestamp("date"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

// ── Calendar events (synced from Google Calendar API per user) ────────────────
export const calendarEvents = pgTable("calendar_event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  calendarEventId: text("calendar_event_id").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  description: text("description"),
  start: timestamp("start"),
  end: timestamp("end_time"), // "end" is reserved in SQL
  location: text("location"),
  attendees: jsonb("attendees").$type<{ email: string; name?: string; status?: string }[]>(),
  status: text("status"), // "confirmed" | "tentative" | "cancelled"
  htmlLink: text("html_link"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

// ── Push notification channels (tracks active Gmail/Calendar/Drive watches) ──
export const syncChannels = pgTable("sync_channel", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  service: text("service").notNull(), // "gmail" | "calendar" | "drive"
  channelId: text("channel_id").notNull().unique(),
  resourceId: text("resource_id"),
  expiration: timestamp("expiration"),
  lastHistoryId: text("last_history_id"),
  lastPageToken: text("last_page_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Per-user preferences (Settings) ───────────────────────────────────────────
// One row per user (keyed by userId, same pattern as googleCredentials). Backs
// the Settings page: appearance (theme/density/motion), the sidebar default,
// regional formatting, and per-category notification preferences. The row is
// created lazily on first read (see app/api/preferences).
//
// notifyPrefs shape: for each category, whether in-app + email delivery is on.
// `email` is stored but inert until an outbound mailer exists.
export type NotifyCategory = "sync" | "leads" | "newsletter" | "team";
export type NotifyPrefs = Record<NotifyCategory, { inApp: boolean; email: boolean }>;

export const userPreferences = pgTable("user_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("system"), // "light" | "dark" | "system"
  density: text("density").notNull().default("comfortable"), // "comfortable" | "compact"
  reduceMotion: boolean("reduce_motion").notNull().default(false),
  railCollapsed: boolean("rail_collapsed").notNull().default(false),
  timezone: text("timezone"), // IANA tz, e.g. "America/New_York"; null = use browser
  dateFormat: text("date_format").notNull().default("auto"), // "auto" | "mdy" | "dmy" | "iso"
  notifyPrefs: jsonb("notify_prefs").$type<NotifyPrefs>(),
  // The Investment CRM's "new responses since you last looked" watermark.
  // null = has never opened the CRM (stamped to now() on first visit so the
  // whole back-catalogue never lands as "new"). Deliberately NOT part of the
  // Preferences type in lib/prefs — it's bookkeeping, not a Settings toggle.
  crmSeenAt: timestamp("crm_seen_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── LP portal: investor profiles ──────────────────────────────────────────────
// One row per LP (limited partner). Created by an admin in /admin/investors —
// usually BEFORE the person has an account, so userId is nullable and gets
// backfilled by email when they accept their invite. `notes` is internal-only
// and must never be sent to the portal.
export const lpProfiles = pgTable("lp_profile", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  email: text("email").notNull().unique(),
  entityName: text("entity_name").notNull(), // e.g. "Cohen Family Trust"
  contactName: text("contact_name"),
  commitmentUsd: integer("commitment_usd"), // whole dollars
  investedUsd: integer("invested_usd"), // whole dollars called/deployed
  status: text("status").notNull().default("active"), // "active" | "archived"
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── LP portal: investor updates (letters) ─────────────────────────────────────
// Written by staff, visible to every active LP once published. Separate from
// blog_post on purpose — The Front Page is marketing, these are LP letters.
export const portalUpdates = pgTable("portal_update", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  authorId: text("author_id").references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"), // "draft" | "published"
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── LP portal: data-room documents ────────────────────────────────────────────
// Either uploaded bytes (same bytea pattern as chat_file) or an external link.
// Visibility is FAIL-CLOSED: a doc is visible to an LP iff sharedWithAll is
// true OR their lp_profile id is in sharedWith. New docs default to hidden.
export const portalDocuments = pgTable("portal_document", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  category: text("category").notNull().default("report"), // report|financials|legal|deck|other
  filename: text("filename"),
  mime: text("mime"),
  size: integer("size"),
  bytes: bytea("bytes"),
  externalUrl: text("external_url"),
  sharedWithAll: boolean("shared_with_all").notNull().default(false),
  sharedWith: jsonb("shared_with").$type<string[]>().default(sql`'[]'::jsonb`), // lp_profile ids
  uploadedBy: text("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── LP portal: curated portfolio companies ────────────────────────────────────
// Admin-curated — intentionally NOT derived from brand_app (the live deal
// pipeline is sensitive). `visible` is fail-closed: nothing shows until staff
// flips it on.
export const portfolioCompanies = pgTable("portfolio_company", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  highlight: text("highlight"), // one-line metric / tagline shown on the card
  website: text("website"),
  logoUrl: text("logo_url"),
  status: text("status").notNull().default("active"), // "active" | "exited"
  investedOn: text("invested_on"), // display date, e.g. "Q1 2026"
  sortOrder: integer("sort_order").notNull().default(0),
  visible: boolean("visible").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── In-app notification feed (the top-bar bell + notification center) ──────────
// Rows are produced server-side via lib/notify/create.ts (which respects the
// user's notifyPrefs) and read/marked-read via app/api/notifications.
export const notifications = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // category-ish tag, e.g. "sync" | "team" | "leads"
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"), // optional deep-link target
    readAt: timestamp("read_at"), // null = unread
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notif_user_created_idx").on(t.userId, t.createdAt)],
);

// ── Web Push subscriptions (lock-screen alerts on the installed phone app) ────
// One row per browser/device a staff member has granted notification permission
// on — the same person can have several (phone + laptop). `endpoint` is the
// push service URL and is globally unique, so it doubles as the natural key for
// re-subscribing the same device.
//
// Subscriptions expire and get revoked constantly (permission withdrawn, app
// deleted, service rotation). The sender treats 404/410 as "gone" and deletes
// the row — see lib/push/send.ts. Never let a dead subscription fail a request.
export const pushSubscriptions = pgTable(
  "push_subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(), // client public key (payload encryption)
    auth: text("auth").notNull(), // client auth secret
    userAgent: text("user_agent"), // so a person can tell their devices apart
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastSentAt: timestamp("last_sent_at"),
  },
  (t) => [index("push_sub_user_idx").on(t.userId)],
);

// ── Artifacts ─────────────────────────────────────────────────────────────────
// A document the user and the agent build together, side-by-side with the chat:
// a memo, a deck, a model, an HTML one-pager. Deliberately NOT stored inside
// chat_message.parts — an artifact outlives the conversation that created it,
// which is the whole point of having a library.
export const artifactKind = pgEnum("artifact_kind", ["document", "deck", "sheet", "html"]);
export const artifactAuthor = pgEnum("artifact_author", ["assistant", "user"]);

export const artifacts = pgTable(
  "artifact",
  {
    id: text("id").primaryKey(), // the model picks a slug; stable across revisions
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Where it was born. Nullable so an artifact survives its chat being deleted.
    chatId: text("chat_id").references(() => chats.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    kind: artifactKind("kind").notNull(),
    content: text("content").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("artifact_user_updated_idx").on(t.userId, t.updatedAt)],
);

// Every accepted change writes one of these, so "the AI ate my edit" is always
// recoverable — including the user's own edits, which is the version that matters.
export const artifactVersions = pgTable(
  "artifact_version",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    authoredBy: artifactAuthor("authored_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("artifact_version_idx").on(t.artifactId, t.version)],
);

// ── Public-site visual editor ("The Press Room") ──────────────────────────────
// One row per editable public page (home/about/apply/jobs/portfolio). Content
// is a jsonb blob validated against lib/site-content/schema.ts on every write
// AND every public read. `published` null = the page falls back to the static
// defaults in lib/site-content/defaults.ts (lazy seeding — no seed script).
export const sitePages = pgTable("site_page", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  draft: jsonb("draft").notNull(),
  published: jsonb("published"),
  draftSavedAt: timestamp("draft_saved_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// One snapshot per Publish, so any live version is recoverable from History.
export const sitePageVersions = pgTable(
  "site_page_version",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pageSlug: text("page_slug").notNull(),
    content: jsonb("content").notNull(),
    publishedBy: text("published_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("site_page_version_idx").on(t.pageSlug, t.createdAt)],
);

// Images uploaded through the editor (same bytea pattern as portal_document),
// served publicly by app/api/site/assets/[id] with an immutable cache header —
// a replaced image is a new row/id, never an overwrite.
export const siteAssets = pgTable("site_asset", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  filename: text("filename"),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  bytes: bytea("bytes").notNull(),
  alt: text("alt"),
  uploadedBy: text("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Events (the Paperboy Invitational) ────────────────────────────────────────
// One row per networking event (golf party, poker night, …). Replaces the
// spring event's Google-Form + hand-typed RSVP spreadsheet: RSVPs come in from
// the public /events/[slug] page, staff run approvals / check-in / pairings /
// scoring / sponsor deliverables from the OS console. `date` is nullable —
// the fall golf party is announced before its date is locked.
export const events = pgTable("event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  date: timestamp("date"),
  venue: text("venue"),
  description: text("description"),
  format: text("format"), // "golf" | "poker" | …
  status: text("status").notNull().default("draft"), // "draft" | "live" | "complete"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A foursome (scramble group). Deleting one unassigns its members
// (event_rsvp.pairing_id → set null) and drops its scores (cascade).
export const eventPairings = pgTable("event_pairing", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  groupNumber: integer("group_number").notNull(),
  teeTime: text("tee_time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// One row per guest per event, deduped by email (a re-submission updates the
// existing row instead of duplicating). Status vocabulary matches the spring
// spreadsheet: pending | approved | approved_player | waitlist | declined.
export const eventRsvps = pgTable(
  "event_rsvp",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    role: text("role"), // "Investor" | "Founder" | "Media" | "Other"
    wantsToPlay: boolean("wants_to_play").default(false),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    pairingId: text("pairing_id").references(() => eventPairings.id, {
      onDelete: "set null",
    }),
    checkedInAt: timestamp("checked_in_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_rsvp_event_email_idx").on(t.eventId, t.email)],
);

// Scramble strokes, one row per (foursome, hole); scoring upserts on that key.
export const eventScores = pgTable(
  "event_score",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    pairingId: text("pairing_id")
      .notNull()
      .references(() => eventPairings.id, { onDelete: "cascade" }),
    hole: integer("hole").notNull(), // 1–18
    strokes: integer("strokes").notNull(),
  },
  (t) => [uniqueIndex("event_score_pairing_hole_idx").on(t.pairingId, t.hole)],
);

// Sponsor slots + the deliverables that used to live buried in PDF agreements.
// `deliverables` is a checklist: [{ label: "5 guaranteed intros", done: false }].
export type EventDeliverable = { label: string; done: boolean };

export const eventSponsors = pgTable("event_sponsor", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  tier: text("tier"), // "title" | "secondary" | "exhibition"
  amount: integer("amount"), // whole dollars
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  deliverables: jsonb("deliverables").$type<EventDeliverable[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
