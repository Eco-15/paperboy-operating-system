import type { brandApps, inquiries } from "@/lib/db/schema";
import type { Deal } from "./types";

// DB row → normalized Deal. Kept in one place because the list API, the by-id
// PATCH route, and the detail server page all need the same mapping.
// SERVER ONLY (imports schema types) — never import from a client component.

export function brandAppToDeal(r: typeof brandApps.$inferSelect): Deal {
  return {
    id: r.id,
    origin: "app",
    company: r.company,
    category: r.category,
    subcategory: r.subcategory,
    source: r.source,
    priority: r.priority,
    stage: r.stage,
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    message: r.message,
    website: r.website,
    deckLink: r.pitchdeckLink ?? r.pitchdeckFile,
    onePager: r.aiOnePager,
    date: r.dateSubmitted,
    arrivedAt: r.createdAt ? r.createdAt.toISOString() : null,
    formType: null,
    fund: r.fund,
    archived: r.archived,
  };
}

export function inquiryToDeal(r: typeof inquiries.$inferSelect): Deal {
  const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ");
  return {
    id: r.id,
    origin: "form",
    company: r.company || fullName || "—",
    category: null,
    subcategory: null,
    source: "Inbound (form)",
    priority: null,
    // Use the persisted triage stage; unset leads show as "New".
    stage: r.stage ?? "New",
    contactName: fullName || null,
    contactEmail: r.email,
    message: r.message,
    website: null,
    deckLink: r.deckName,
    onePager: null,
    date: r.createdAt ? r.createdAt.toISOString() : null,
    arrivedAt: r.createdAt ? r.createdAt.toISOString() : null,
    formType: r.type,
    fund: r.fund,
    archived: r.archived,
  };
}
