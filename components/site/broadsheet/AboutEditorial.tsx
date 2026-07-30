/* eslint-disable @next/next/no-img-element */
import { CONTACT_EMAIL } from "@/lib/marketing/brand";
import type { AboutContent } from "@/lib/site-content/schema";
import InlineText from "@/components/site/InlineText";

export default function AboutEditorial({ content }: { content: AboutContent }) {
  return (
    <>
      <h1 className="fp-headline fp-headline--xl sheet-section-title">
        {content.title}
      </h1>
      <div className="fp-byline">{content.byline}</div>

      <div className="sheet-editorial">
        <div className="fp-body fp-body--2">
          {content.paragraphs.map((p, i) => (
            <p key={i}>
              <InlineText value={p} dropcap={i === 0} />
            </p>
          ))}
        </div>

        <aside className="sheet-editorial-aside">
          <figure className="fp-cut">
            <div className="fp-cut-img">
              <img src={content.aside.imageSrc} alt={content.aside.name} />
            </div>
            <figcaption className="fp-cut-cap">
              {content.aside.imageCaption}
            </figcaption>
          </figure>
          <div className="fp-headline sheet-publisher-name">
            {content.aside.name}
          </div>
          <div className="fp-byline sheet-publisher-role">
            {content.aside.role}
          </div>
          <p className="site-fine">
            Founders &amp; LPs — write the desk:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </aside>
      </div>
    </>
  );
}
