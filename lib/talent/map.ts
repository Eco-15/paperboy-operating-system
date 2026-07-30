import type { talents } from "@/lib/db/schema";
import type { TalentRec } from "./types";

// DB row → normalized TalentRec. Kept in one place because the list API, the
// by-id PATCH route, and the detail server page all need the same mapping.
// SERVER ONLY (imports schema types) — never import from a client component.

export function talentToRec(r: typeof talents.$inferSelect): TalentRec {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    company: r.company,
    email: r.email,
    link: r.link,
    location: r.location,
    source: r.source,
    priority: r.priority,
    stage: r.stage,
    notes: r.notes,
    date: r.createdAt ? r.createdAt.toISOString() : null,
    archived: r.archived,
  };
}
