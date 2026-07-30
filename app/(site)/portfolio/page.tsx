import type { Metadata } from "next";
import Sheet from "@/components/site/Sheet";
import PortfolioGrid from "@/components/site/broadsheet/PortfolioGrid";
import SectionHeader from "@/components/site/broadsheet/SectionHeader";
import { PRESS_POSTS } from "@/lib/marketing/pressPosts";
import { SHEET_DEFAULTS } from "@/lib/site-content/defaults";
import { getPublishedContent, resolveSiteContent } from "@/lib/site-content/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublishedContent("portfolio");
  return {
    title: content.seo?.title ?? "Portfolio",
    description:
      content.seo?.description ??
      "Fund I holdings of Paperboy Ventures — Maxine's Heavenly, Seatopia, and Ripi.",
  };
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const content = await resolveSiteContent("portfolio", searchParams);
  const dispatchSlugs: Record<string, string> = {};
  for (const card of content.cards) {
    const post = PRESS_POSTS.find((p) => p.slug === card.id);
    if (post) dispatchSlugs[card.id] = post.slug;
  }
  const sheet = content.sheet ?? SHEET_DEFAULTS.portfolio;
  return (
    <Sheet section={sheet.section} kicker={sheet.kicker} isFront={false}>
      <SectionHeader
        title={content.title}
        deck={content.deck}
        byline={content.byline}
      />
      <PortfolioGrid content={content} dispatchSlugs={dispatchSlugs} />
    </Sheet>
  );
}
