import type { Metadata } from "next";
import Sheet from "@/components/site/Sheet";
import AboutEditorial from "@/components/site/broadsheet/AboutEditorial";
import { SHEET_DEFAULTS } from "@/lib/site-content/defaults";
import { getPublishedContent, resolveSiteContent } from "@/lib/site-content/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublishedContent("about");
  return {
    title: content.seo?.title ?? "About",
    description:
      content.seo?.description ??
      "Paperboy Ventures is a consumer-focused investment desk backing breakout food and beverage brands.",
  };
}

export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const content = await resolveSiteContent("about", searchParams);
  const sheet = content.sheet ?? SHEET_DEFAULTS.about;
  return (
    <Sheet section={sheet.section} kicker={sheet.kicker} isFront={false}>
      <AboutEditorial content={content} />
    </Sheet>
  );
}
