/* eslint-disable @next/next/no-img-element */
import { ARTICLES } from "@/lib/marketing/frontPageArticles";

// Static "The Front Page" newspaper — the four example investments as articles,
// each with a Higgsfield engraving cut. No scroll effect.
export default function FrontPagePaper() {
  const [lead, ...rest] = ARTICLES;
  return (
    <div className="fp-canvas">
      <div className="fp-folio">
        <span>Vol. I · No. 1</span>
        <span>Paperboy Ventures</span>
        <span>Price: Free</span>
      </div>
      <div className="fp-masthead">The Front Page</div>
      <div className="fp-rule" />
      <div className="fp-kicker">Investing in Breakout Consumer Brands</div>

      <article className="fp-article fp-lead">
        <h3 className="fp-headline fp-headline--xl">{lead.headline}</h3>
        <p className="fp-deck">{lead.deck}</p>
        <div className="fp-byline">By The Paperboy Desk · New York</div>
        <div className="fp-lead-grid">
          <figure className="fp-cut">
            <div className="fp-cut-img">
              <img src={lead.image} alt={lead.brand} />
            </div>
            <figcaption className="fp-cut-cap">{lead.brand}</figcaption>
          </figure>
          <div className="fp-body fp-body--2">
            {lead.body.map((p, i) => (
              <p key={i}>
                {i === 0 ? <span className="fp-dropcap">{p.charAt(0)}</span> : null}
                {i === 0 ? p.slice(1) : p}
              </p>
            ))}
          </div>
        </div>
      </article>

      <div className="fp-row">
        {rest.map((a) => (
          <article key={a.id} className="fp-article">
            <h3 className="fp-headline">{a.headline}</h3>
            <figure className="fp-cut">
              <div className="fp-cut-img">
                <img src={a.image} alt={a.brand} />
              </div>
              <figcaption className="fp-cut-cap">{a.brand}</figcaption>
            </figure>
            <p className="fp-deck fp-deck--sm">{a.deck}</p>
            <div className="fp-body">
              {a.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
