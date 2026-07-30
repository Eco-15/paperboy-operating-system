import type { Metadata } from "next";
import Sheet from "@/components/site/Sheet";
import HomeBroadsheet from "@/components/site/broadsheet/HomeBroadsheet";
import { SHEET_DEFAULTS } from "@/lib/site-content/defaults";
import { getPublishedContent, resolveSiteContent } from "@/lib/site-content/store";

// Content is editable from the OS Site Editor; read it fresh per request so
// Publish is instantly live.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublishedContent("home");
  return {
    title: content.seo?.title ?? {
      absolute: "Paperboy Ventures — Investing in Breakout Consumer Brands",
    },
    description: content.seo?.description,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const content = await resolveSiteContent("home", searchParams);
  const sheet = content.sheet ?? SHEET_DEFAULTS.home;
  return (
    <Sheet section={sheet.section} kicker={sheet.kicker} isFront>
      <HomeBroadsheet content={content} />
    </Sheet>
  );
}
