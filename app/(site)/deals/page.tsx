/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import Sheet from "@/components/site/Sheet";
import CouponForm from "@/components/site/CouponForm";
import DealsBroadsheet from "@/components/site/broadsheet/DealsBroadsheet";
import { PRESS_POSTS } from "@/lib/marketing/pressPosts";
import { SHEET_DEFAULTS } from "@/lib/site-content/defaults";
import { getPublishedContent, resolveSiteContent } from "@/lib/site-content/store";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublishedContent("deals");
  return {
    title: content.seo?.title ?? "DEALS",
    description:
      content.seo?.description ??
      "DEALS — finely curated early-stage deals for investors tracking startup CPGs, from Paperboy Ventures.",
  };
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const content = await resolveSiteContent("deals", searchParams);
  const sheet = content.sheet ?? SHEET_DEFAULTS.deals;
  return (
    <Sheet section={sheet.section} kicker={sheet.kicker} isFront={false}>
      <DealsBroadsheet
        content={content}
        form={
          <CouponForm
            title="Subscribe to DEALS"
            action="/api/subscribe"
            extra={{ list: "deals" }}
            fields={[
              {
                name: "email",
                label: "Email address",
                type: "email",
                required: true,
                placeholder: "you@firm.com",
              },
            ]}
            submitLabel="Subscribe"
            successLine="Received — the next edition of DEALS is on its way."
          />
        }
        archive={PRESS_POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/press/${post.slug}`}
            className="sheet-press-card"
          >
            <article className="fp-article">
              <div className="site-press-date">
                {post.tag ? `${post.tag} · ` : ""}
                {formatDate(post.date)}
              </div>
              <h2 className="fp-headline">
                <span>{post.title}</span>
              </h2>
              <figure className="site-photo" style={{ margin: "12px 0" }}>
                <img src={post.heroImage} alt={post.title} />
              </figure>
              <p className="fp-deck fp-deck--sm">{post.excerpt}</p>
            </article>
          </Link>
        ))}
      />
    </Sheet>
  );
}
