// Content models for the editable public site ("The Press Room" editor).
// These zod schemas are the single contract shared by the editor client, the
// site-editor API (draft validation), and the public read path (published
// jsonb is re-validated on every read and falls back to the static defaults).

import { z } from "zod";

export const SITE_PAGE_SLUGS = [
  "home",
  "about",
  "apply",
  "jobs",
  "portfolio",
  "deals",
] as const;

export type SitePageSlug = (typeof SITE_PAGE_SLUGS)[number];

export function isSitePageSlug(value: string): value is SitePageSlug {
  return (SITE_PAGE_SLUGS as readonly string[]).includes(value);
}

const zText = z.string().max(4000);

// Per-page chrome (the Sheet folio/kicker) and SEO — optional everywhere so
// pre-v2 jsonb rows keep parsing (a required field would silently revert the
// live page to defaults via the fail-open read path).
export const zSheetChrome = z.object({ section: zText, kicker: zText });
export type SheetChrome = z.infer<typeof zSheetChrome>;

export const zSeo = z.object({
  title: zText.optional(),
  description: zText.optional(),
});
export type Seo = z.infer<typeof zSeo>;

export const zStory = z.object({
  id: z.string().min(1),
  headline: zText,
  deck: zText.optional(),
  byline: zText.optional(),
  body: z.array(zText),
  href: z.string(),
  external: z.boolean().optional(),
  cut: z
    .object({ src: z.string(), caption: zText, alt: zText.optional() })
    .optional(),
  xref: z
    .object({ label: zText, href: z.string(), external: z.boolean().optional() })
    .optional(),
});
export type Story = z.infer<typeof zStory>;

export const zClassified = z.object({
  kicker: zText,
  line: zText,
  href: z.string(),
});
export type Classified = z.infer<typeof zClassified>;

export const zHomeContent = z.object({
  classifieds: z.array(zClassified),
  lead: zStory,
  columnStories: z.array(zStory),
  footStories: z.array(zStory),
  sheet: zSheetChrome.optional(),
  seo: zSeo.optional(),
});
export type HomeContent = z.infer<typeof zHomeContent>;

export const zAboutContent = z.object({
  title: zText,
  byline: zText,
  paragraphs: z.array(zText),
  aside: z.object({
    imageSrc: z.string(),
    imageCaption: zText,
    name: zText,
    role: zText,
  }),
  sheet: zSheetChrome.optional(),
  seo: zSeo.optional(),
});
export type AboutContent = z.infer<typeof zAboutContent>;

export const zApplyContent = z.object({
  title: zText,
  deck: zText,
  byline: zText,
  notice: z.object({ head: zText, paragraphs: z.array(zText) }),
  sheet: zSheetChrome.optional(),
  seo: zSeo.optional(),
});
export type ApplyContent = z.infer<typeof zApplyContent>;

export const zJobsContent = z.object({
  title: zText,
  deck: zText,
  byline: zText,
  sheet: zSheetChrome.optional(),
  seo: zSeo.optional(),
});
export type JobsContent = z.infer<typeof zJobsContent>;

export const zDealsContent = z.object({
  title: zText,
  deck: zText,
  byline: zText,
  notice: z.object({ head: zText, paragraphs: z.array(zText) }),
  ledgerHead: zText,
  sheet: zSheetChrome.optional(),
  seo: zSeo.optional(),
});
export type DealsContent = z.infer<typeof zDealsContent>;

export const zPortfolioCard = z.object({
  id: z.string().min(1),
  brand: zText,
  sector: zText,
  thesis: zText,
  tag: zText,
  href: z.string().optional(),
  cutSrc: z.string().optional(),
  cutCaption: zText.optional(),
  cutAlt: zText.optional(),
});
export type PortfolioCard = z.infer<typeof zPortfolioCard>;

export const zPortfolioContent = z.object({
  title: zText,
  deck: zText,
  byline: zText,
  cards: z.array(zPortfolioCard),
  sheet: zSheetChrome.optional(),
  seo: zSeo.optional(),
});
export type PortfolioContent = z.infer<typeof zPortfolioContent>;

export const PAGE_SCHEMAS: Record<SitePageSlug, z.ZodTypeAny> = {
  home: zHomeContent,
  about: zAboutContent,
  apply: zApplyContent,
  jobs: zJobsContent,
  portfolio: zPortfolioContent,
  deals: zDealsContent,
};

export type SitePageContent = {
  home: HomeContent;
  about: AboutContent;
  apply: ApplyContent;
  jobs: JobsContent;
  portfolio: PortfolioContent;
  deals: DealsContent;
};
