import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Server-side: require any signed-in user, else send to /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Server-side: require one of `roles`, else bounce to that role's home. */
export async function requireRole(roles: string[]) {
  const user = await requireUser();
  if (!user.role || !roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}

/** True for staff (used to gate write actions and the Drive-grounded chat). */
export function isStaff(role?: string | null): boolean {
  return role === "admin" || role === "internal";
}

/** True for LPs — the investor portal audience. */
export function isInvestor(role?: string | null): boolean {
  return role === "investor";
}

/** Where a signed-in user lands: LPs live in /portal, everyone else in the OS. */
export function homePathFor(role?: string | null): string {
  return isInvestor(role) ? "/portal" : "/dashboard";
}

/**
 * Server-side gate for the investor portal: investors get in, staff get in
 * (to preview what LPs see), everyone else is bounced to their home.
 */
export async function requirePortalUser() {
  const user = await requireUser();
  if (!isInvestor(user.role) && !isStaff(user.role)) redirect("/dashboard");
  return user;
}
