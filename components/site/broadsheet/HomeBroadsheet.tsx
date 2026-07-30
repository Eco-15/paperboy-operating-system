// The full front-page composition (everything inside <Sheet>), driven by a
// HomeContent object. Pure and server-compatible; the same markup is mirrored
// by the Site Editor canvas, so class recipes here must stay in sync with
// components/site-editor/HomeCanvas.tsx.

import Link from "next/link";
import type { HomeContent, Story } from "@/lib/site-content/schema";
import InlineText from "@/components/site/InlineText";
import Headline from "./Headline";
import Cut from "./Cut";
import Xref from "./Xref";

export const LEAD_BYLINE_FALLBACK = "By The Paperboy Desk · New York";

export function ClassifiedsStrip({
  items,
}: {
  items: HomeContent["classifieds"];
}) {
  if (items.length === 0) return null;
  return (
    <div className="sheet-classifieds sheet-classifieds--top">
      {items.map((c, i) => (
        <Link key={`${c.href}:${i}`} className="sheet-classified" href={c.href}>
          <div className="sheet-classified-kicker">{c.kicker}</div>
          <div className="sheet-classified-line">{c.line}</div>
        </Link>
      ))}
    </div>
  );
}

export function LeadStory({ story }: { story: Story }) {
  return (
    <article className="fp-article fp-lead">
      <Headline story={story} className="fp-headline fp-headline--xl" />
      <p className="fp-deck">
        <InlineText value={story.deck ?? ""} />
      </p>
      <div className="fp-byline">{story.byline ?? LEAD_BYLINE_FALLBACK}</div>
      <div className="fp-lead-grid">
        <Cut story={story} />
        <div className="fp-body fp-body--2">
          {story.body.map((p, i) => (
            <p key={i}>
              <InlineText value={p} dropcap={i === 0} />
            </p>
          ))}
          <Xref story={story} />
        </div>
      </div>
    </article>
  );
}

export function ColumnStoryCard({ story }: { story: Story }) {
  return (
    <article className="fp-article">
      <Headline story={story} className="fp-headline" />
      <Cut story={story} />
      {story.deck ? (
        <p className="fp-deck fp-deck--sm">
          <InlineText value={story.deck} />
        </p>
      ) : null}
      {story.byline ? <div className="fp-byline">{story.byline}</div> : null}
      <div className="fp-body">
        {story.body.map((p, i) => (
          <p key={i}>
            <InlineText value={p} />
          </p>
        ))}
      </div>
      <Xref story={story} />
    </article>
  );
}

export function FootStoryCard({ story }: { story: Story }) {
  return (
    <article className="fp-article sheet-foot-article">
      <Headline story={story} className="fp-headline" />
      <div className="sheet-foot-grid">
        <Cut story={story} />
        <div>
          {story.deck ? (
            <p className="fp-deck fp-deck--sm">
              <InlineText value={story.deck} />
            </p>
          ) : null}
          {story.byline ? <div className="fp-byline">{story.byline}</div> : null}
          <div className="fp-body">
            {story.body.map((p, i) => (
              <p key={i}>
                <InlineText value={p} />
              </p>
            ))}
          </div>
          <Xref story={story} />
        </div>
      </div>
    </article>
  );
}

export default function HomeBroadsheet({ content }: { content: HomeContent }) {
  return (
    <>
      <ClassifiedsStrip items={content.classifieds} />
      <LeadStory story={content.lead} />
      {content.columnStories.length > 0 ? (
        <div className="fp-row">
          {content.columnStories.map((story) => (
            <ColumnStoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : null}
      {content.footStories.length > 0 ? (
        <div className="sheet-row-2">
          {content.footStories.map((story) => (
            <FootStoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : null}
    </>
  );
}
