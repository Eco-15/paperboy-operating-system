import { auth } from "@/auth";
import { isStaff } from "./guards";

/**
 * API-route guard: returns the session user when they're staff, else null
 * (the caller responds 403). The redirect-based guards in guards.ts are for
 * pages; this is the equivalent for route handlers.
 */
export async function staffApiUser() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) return null;
  return session.user;
}
