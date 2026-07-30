import type { Metadata } from "next";
import Link from "next/link";
import Sheet from "@/components/site/Sheet";
import CouponForm from "@/components/site/CouponForm";
import InlineText from "@/components/site/InlineText";
import SectionHeader from "@/components/site/broadsheet/SectionHeader";
import { APPLY_FORM } from "@/lib/site-content/formConfigs";
import { SHEET_DEFAULTS } from "@/lib/site-content/defaults";
import { getPublishedContent, resolveSiteContent } from "@/lib/site-content/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublishedContent("apply");
  return {
    title: content.seo?.title ?? "Apply",
    description:
      content.seo?.description ??
      "Apply for content features and/or direct investment via Paperboy Fund I.",
  };
}

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const content = await resolveSiteContent("apply", searchParams);
  const sheet = content.sheet ?? SHEET_DEFAULTS.apply;
  return (
    <Sheet section={sheet.section} kicker={sheet.kicker} isFront={false}>
      <SectionHeader
        title={content.title}
        deck={content.deck}
        byline={content.byline}
      />

      <div className="sheet-apply-grid">
        <CouponForm {...APPLY_FORM} />

        <aside>
          <div className="sheet-notice">
            <div className="sheet-notice-head">{content.notice.head}</div>
            <div className="fp-body">
              {content.notice.paragraphs.map((p, i) => (
                <p key={i}>
                  <InlineText value={p} />
                </p>
              ))}
            </div>
          </div>
          <div className="sheet-xref-row" style={{ marginTop: 18 }}>
            <Link className="sheet-xref" href="/deals">
              About DEALS →
            </Link>
            <Link className="sheet-xref" href="/portfolio">
              See the portfolio →
            </Link>
          </div>
        </aside>
      </div>
    </Sheet>
  );
}
