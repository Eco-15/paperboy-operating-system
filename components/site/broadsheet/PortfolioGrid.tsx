/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { PortfolioContent } from "@/lib/site-content/schema";
import InlineText from "@/components/site/InlineText";

// dispatchSlugs maps card id → press-post slug for the "Read the dispatch"
// cross-link; the server page derives it from PRESS_POSTS so this component
// stays client-safe (pressPosts.ts is a ~600-line module).
export default function PortfolioGrid({
  content,
  dispatchSlugs = {},
}: {
  content: PortfolioContent;
  dispatchSlugs?: Record<string, string>;
}) {
  return (
    <div className="fp-row">
      {content.cards.map((card) => {
        const dispatchSlug = dispatchSlugs[card.id];
        return (
          <article key={card.id} className="fp-article">
            <h2 className="fp-headline">{card.brand}</h2>
            {card.cutSrc ? (
              <figure className="fp-cut">
                <div className="fp-cut-img">
                  <img src={card.cutSrc} alt={card.cutAlt ?? card.brand} />
                </div>
                <figcaption className="fp-cut-cap">
                  {card.cutCaption ?? `${card.brand} · ${card.tag}`}
                </figcaption>
              </figure>
            ) : null}
            <p className="fp-deck fp-deck--sm">{card.sector}</p>
            <div className="fp-body">
              <p>
                <InlineText value={card.thesis} />
              </p>
            </div>
            <div className="sheet-xref-row">
              {card.href ? (
                <a
                  className="sheet-xref"
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit {card.brand} →
                </a>
              ) : null}
              {dispatchSlug ? (
                <Link className="sheet-xref" href={`/press/${dispatchSlug}`}>
                  Read the dispatch →
                </Link>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
