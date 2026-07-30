import { desc, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  lpProfiles,
  portalDocuments,
  portalUpdates,
  portfolioCompanies,
} from "@/lib/db/schema";
import { isInvestor, isStaff } from "@/lib/auth/guards";

// Every portal read goes through this module so the LP scoping rules live in
// exactly one place. The rules are FAIL-CLOSED:
//   - no lp_profile        → no personal data, only shared-with-all content
//   - document visibility  → sharedWithAll OR the LP's id is explicitly listed
//   - updates              → published only
//   - portfolio            → visible=true only
// Staff (admin/internal) pass through so they can preview what LPs see.

export type PortalUser = {
  id: string;
  email?: string | null;
  role?: string | null;
};

export type LpProfile = typeof lpProfiles.$inferSelect;

function portalRole(user: PortalUser): "investor" | "staff" | null {
  if (isInvestor(user.role)) return "investor";
  if (isStaff(user.role)) return "staff";
  return null;
}

/**
 * Resolve the LP profile for the signed-in user. Admins create profiles by
 * email before the invite is accepted, so on first visit we link the profile
 * to the account by email match — but never steal a profile that's already
 * linked to a different account.
 */
export async function getLpForUser(user: PortalUser): Promise<LpProfile | null> {
  if (!user.id) return null;
  const [byUser] = await db
    .select()
    .from(lpProfiles)
    .where(eq(lpProfiles.userId, user.id))
    .limit(1);
  if (byUser) return byUser;

  if (!user.email || !isInvestor(user.role)) return null;
  const [byEmail] = await db
    .select()
    .from(lpProfiles)
    .where(eq(lpProfiles.email, user.email.toLowerCase()))
    .limit(1);
  if (!byEmail || byEmail.userId) return null;

  const [linked] = await db
    .update(lpProfiles)
    .set({ userId: user.id, updatedAt: new Date() })
    .where(eq(lpProfiles.id, byEmail.id))
    .returning();
  return linked ?? null;
}

/** Document metadata only — `bytes` is intentionally never selected here. */
export type PortalDocumentMeta = {
  id: string;
  title: string;
  category: string;
  filename: string | null;
  mime: string | null;
  size: number | null;
  externalUrl: string | null;
  createdAt: Date;
};

const docMetaColumns = {
  id: portalDocuments.id,
  title: portalDocuments.title,
  category: portalDocuments.category,
  filename: portalDocuments.filename,
  mime: portalDocuments.mime,
  size: portalDocuments.size,
  externalUrl: portalDocuments.externalUrl,
  createdAt: portalDocuments.createdAt,
  sharedWithAll: portalDocuments.sharedWithAll,
  sharedWith: portalDocuments.sharedWith,
};

function docVisibleTo(
  doc: { sharedWithAll: boolean; sharedWith: string[] | null },
  lpId: string | null,
): boolean {
  if (doc.sharedWithAll) return true;
  return !!lpId && (doc.sharedWith ?? []).includes(lpId);
}

/** Documents the signed-in user may see (staff preview sees everything). */
export async function listVisibleDocuments(
  user: PortalUser,
  lp: LpProfile | null,
): Promise<PortalDocumentMeta[]> {
  const role = portalRole(user);
  if (!role) return [];
  const rows = await db
    .select(docMetaColumns)
    .from(portalDocuments)
    .orderBy(desc(portalDocuments.createdAt));
  const visible =
    role === "staff" ? rows : rows.filter((r) => docVisibleTo(r, lp?.id ?? null));
  return visible.map(({ sharedWithAll: _a, sharedWith: _b, ...meta }) => meta);
}

/**
 * Full document row (including bytes) for download — returns null unless the
 * user is allowed to open it.
 */
export async function getDocumentForDownload(user: PortalUser, docId: string) {
  const role = portalRole(user);
  if (!role) return null;
  const [doc] = await db
    .select()
    .from(portalDocuments)
    .where(eq(portalDocuments.id, docId))
    .limit(1);
  if (!doc) return null;
  if (role === "staff") return doc;
  const lp = await getLpForUser(user);
  return docVisibleTo(doc, lp?.id ?? null) ? doc : null;
}

export type PortalUpdate = typeof portalUpdates.$inferSelect;

export async function listPublishedUpdates(): Promise<PortalUpdate[]> {
  return db
    .select()
    .from(portalUpdates)
    .where(eq(portalUpdates.status, "published"))
    .orderBy(desc(portalUpdates.publishedAt));
}

export async function getPublishedUpdate(id: string): Promise<PortalUpdate | null> {
  const [row] = await db
    .select()
    .from(portalUpdates)
    .where(eq(portalUpdates.id, id))
    .limit(1);
  return row && row.status === "published" ? row : null;
}

export type PortfolioCompany = typeof portfolioCompanies.$inferSelect;

export async function listVisiblePortfolio(): Promise<PortfolioCompany[]> {
  return db
    .select()
    .from(portfolioCompanies)
    .where(eq(portfolioCompanies.visible, true))
    .orderBy(asc(portfolioCompanies.sortOrder), asc(portfolioCompanies.createdAt));
}
