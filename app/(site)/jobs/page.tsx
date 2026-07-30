import type { Metadata } from "next";
import Sheet from "@/components/site/Sheet";
import CouponForm from "@/components/site/CouponForm";
import SectionHeader from "@/components/site/broadsheet/SectionHeader";
import { JOBS_FORMS } from "@/lib/site-content/formConfigs";
import { SHEET_DEFAULTS } from "@/lib/site-content/defaults";
import { getPublishedContent, resolveSiteContent } from "@/lib/site-content/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublishedContent("jobs");
  return {
    title: content.seo?.title ?? "Jobs",
    description:
      content.seo?.description ??
      "The best roles in CPG — handpicked and delivered fresh each week by Paperboy Ventures.",
  };
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const content = await resolveSiteContent("jobs", searchParams);
  const sheet = content.sheet ?? SHEET_DEFAULTS.jobs;
  return (
    <Sheet section={sheet.section} kicker={sheet.kicker} isFront={false}>
      <SectionHeader
        title={content.title}
        deck={content.deck}
        byline={content.byline}
      />

      <div className="fp-row">
        {JOBS_FORMS.map((form) => (
          <CouponForm key={form.title} {...form} />
        ))}
      </div>
    </Sheet>
  );
}
