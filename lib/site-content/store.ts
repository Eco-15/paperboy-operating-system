// Server-side read path for editable public pages. FAIL-OPEN to the static
// defaults: any miss (no row, no DB, invalid jsonb) renders the site exactly
// as it ships in code — the public site must never 500 because of the editor.

import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sitePages } from "@/lib/db/schema";
import { PAGE_DEFAULTS } from "./defaults";
import { PAGE_SCHEMAS, type SitePageContent, type SitePageSlug } from "./schema";

// cache(): generateMetadata and the page body share one query per request.
const readRow = cache(async (slug: SitePageSlug) => {
  const [row] = await db
    .select({
      draft: sitePages.draft,
      published: sitePages.published,
    })
    .from(sitePages)
    .where(eq(sitePages.slug, slug))
    .limit(1);
  return row ?? null;
});

function parseOrFallback<S extends SitePageSlug>(
  slug: S,
  value: unknown,
): SitePageContent[S] {
  if (value == null) return PAGE_DEFAULTS[slug];
  const parsed = PAGE_SCHEMAS[slug].safeParse(value);
  if (!parsed.success) {
    console.warn(`[site-content] invalid ${slug} content, using default:`, parsed.error.message);
    return PAGE_DEFAULTS[slug];
  }
  return parsed.data as SitePageContent[S];
}

export async function getPublishedContent<S extends SitePageSlug>(
  slug: S,
): Promise<SitePageContent[S]> {
  try {
    const row = await readRow(slug);
    return parseOrFallback(slug, row?.published);
  } catch (err) {
    console.warn(`[site-content] read failed for ${slug}, using default:`, err);
    return PAGE_DEFAULTS[slug];
  }
}

// What a public page should render: the published content, or — for signed-in
// staff visiting with ?draft=1 (the editor's preview) — the current draft.
export async function resolveSiteContent<S extends SitePageSlug>(
  slug: S,
  searchParams: Promise<{ draft?: string }>,
): Promise<SitePageContent[S]> {
  const { draft } = await searchParams;
  if (draft === "1") {
    const session = await auth();
    if (isStaff(session?.user?.role)) return getDraftContent(slug);
  }
  return getPublishedContent(slug);
}

export async function getDraftContent<S extends SitePageSlug>(
  slug: S,
): Promise<SitePageContent[S]> {
  try {
    const row = await readRow(slug);
    return parseOrFallback(slug, row?.draft);
  } catch (err) {
    console.warn(`[site-content] draft read failed for ${slug}, using default:`, err);
    return PAGE_DEFAULTS[slug];
  }
}
