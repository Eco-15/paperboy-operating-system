// The DEALS page body, driven by DealsContent. The subscribe form and the
// press-archive grid are passed as slots so this markup lives once (public
// page passes the real CouponForm + PRESS_POSTS grid; the editor canvas
// passes inert placeholders). The gold "." after the title is template, not
// content — it survives any title edit.

import Link from "next/link";
import type { DealsContent } from "@/lib/site-content/schema";
import InlineText from "@/components/site/InlineText";

export default function DealsBroadsheet({
  content,
  form,
  archive,
}: {
  content: DealsContent;
  form: React.ReactNode;
  archive: React.ReactNode;
}) {
  return (
    <>
      <h1 className="fp-headline fp-headline--xl sheet-section-title">
        {content.title}
        <span style={{ color: "#b78b39" }}>.</span>
      </h1>
      <p className="fp-deck">
        <InlineText value={content.deck} />
      </p>
      <div className="fp-byline">{content.byline}</div>

      <div className="sheet-deals-grid">
        <div>
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
            <Link className="sheet-xref" href="/press">
              Read the dispatches →
            </Link>
            <Link className="sheet-xref" href="/apply">
              Founders: apply for a feature →
            </Link>
          </div>
        </div>

        {form}
      </div>

      <div className="sheet-deals-ledger-head">
        <div className="fp-rule" />
        <div className="sheet-notice-head" style={{ margin: "18px 0 0" }}>
          {content.ledgerHead}
        </div>
      </div>
      <div className="sheet-deals-ledger">{archive}</div>
    </>
  );
}
