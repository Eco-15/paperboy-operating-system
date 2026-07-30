import type { ObjectTypeDef, ActionTypeDef, ActionContext } from "./types";
import { isStaff } from "../auth/guards";

// The canonical identity an ontology caller acts under. Structurally identical to
// ActionContext["session"] — `user.id` MUST be the `users.id` UUID (never an email:
// owner-scoping in the query engine compares it against `user_id` FK columns).
export type OntologySession = NonNullable<ActionContext["session"]>;

// ── The role gate ─────────────────────────────────────────────────────────────
// CRITICAL: the query engine (lib/ontology/query.ts) enforces OWNER-scoping and
// fails closed for Chat/GmailMessage/CalendarEvent — but it does NOT enforce the
// admin/internal/any `readRole` gate. Any host that calls queryObjects/
// getObjectById directly (the chat agent, the MCP server) must apply this, or
// non-staff can read internal-only types (Deal, DriveFile, User, Invite, …).
export function canRead(typeDef: ObjectTypeDef, session: OntologySession | null): boolean {
  if (!session?.user?.id) return false; // no identity → no reads
  const role = session.user.role;
  if (typeDef.readRole === "admin") return role === "admin";
  if (typeDef.readRole === "internal") return isStaff(role);
  return true; // "any" / undefined → any authenticated user
}

export function canAct(actionDef: ActionTypeDef, session: OntologySession | null): boolean {
  if (actionDef.requiredRole === "public") return true;
  if (!session?.user?.id) return false;
  const role = session.user.role;
  if (actionDef.requiredRole === "admin") return role === "admin";
  if (actionDef.requiredRole === "internal") return isStaff(role);
  return true; // "any"
}
