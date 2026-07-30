"use client";

// WYSIWYG canvases for the simple pages (About / Apply / Jobs / DEALS): keyed
// text regions, rich paragraphs, and the About portrait. Coupon forms render
// for real so the page looks true, but they're inert — their fields are code.
// Also exports the read-only Preview compositions used by preview mode.

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import CouponForm from "@/components/site/CouponForm";
import InlineText from "@/components/site/InlineText";
import DealsBroadsheet from "@/components/site/broadsheet/DealsBroadsheet";
import SectionHeader from "@/components/site/broadsheet/SectionHeader";
import { CONTACT_EMAIL } from "@/lib/marketing/brand";
import { APPLY_FORM, JOBS_FORMS } from "@/lib/site-content/formConfigs";
import type {
  AboutContent,
  ApplyContent,
  DealsContent,
  JobsContent,
} from "@/lib/site-content/schema";
import { addParagraph } from "@/lib/site-content/mutations";
import EditableText from "./EditableText";
import AssetPicker from "./AssetPicker";
import { EditableBody } from "./CanvasBits";

function DimmedForms({
  children,
  badge = "Form — configured in code",
}: {
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="se-inert-form" title={badge}>
      {children}
      <div className="se-inert-badge">{badge}</div>
    </div>
  );
}

export function AboutCanvas({
  content,
  onCommit,
}: {
  content: AboutContent;
  onCommit: (next: AboutContent) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <h1 className="fp-headline fp-headline--xl sheet-section-title">
        <EditableText
          value={content.title}
          onCommit={(title) => onCommit({ ...content, title })}
        />
      </h1>
      <div className="fp-byline">
        <EditableText
          value={content.byline}
          onCommit={(byline) => onCommit({ ...content, byline })}
        />
      </div>

      <div className="sheet-editorial">
        <EditableBody
          className="fp-body fp-body--2"
          body={content.paragraphs}
          pathPrefix="about"
          onChange={(paragraphs) => onCommit({ ...content, paragraphs })}
          extraChildren={
            <button
              type="button"
              className="se-add-inline"
              onClick={() =>
                onCommit({ ...content, paragraphs: addParagraph(content.paragraphs) })
              }
            >
              + Add paragraph
            </button>
          }
        />

        <aside className="sheet-editorial-aside">
          <figure className="fp-cut">
            <div className="fp-cut-img se-cut-img">
              <img src={content.aside.imageSrc} alt={content.aside.name} />
              <div className="se-cut-actions">
                <button type="button" onClick={() => setPicking(true)}>
                  Change
                </button>
              </div>
            </div>
            <figcaption className="fp-cut-cap">
              <EditableText
                value={content.aside.imageCaption}
                onCommit={(imageCaption) =>
                  onCommit({ ...content, aside: { ...content.aside, imageCaption } })
                }
              />
            </figcaption>
          </figure>
          <div className="fp-headline sheet-publisher-name">
            <EditableText
              value={content.aside.name}
              onCommit={(name) =>
                onCommit({ ...content, aside: { ...content.aside, name } })
              }
            />
          </div>
          <div className="fp-byline sheet-publisher-role">
            <EditableText
              value={content.aside.role}
              onCommit={(role) =>
                onCommit({ ...content, aside: { ...content.aside, role } })
              }
            />
          </div>
          <p className="site-fine">
            Founders &amp; LPs — write the desk:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          {picking ? (
            <AssetPicker
              onPick={(src) => {
                onCommit({ ...content, aside: { ...content.aside, imageSrc: src } });
                setPicking(false);
              }}
              onClose={() => setPicking(false)}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}

function EditableHeader({
  title,
  deck,
  byline,
  onTitle,
  onDeck,
  onByline,
}: {
  title: string;
  deck: string;
  byline: string;
  onTitle: (v: string) => void;
  onDeck: (v: string) => void;
  onByline: (v: string) => void;
}) {
  return (
    <>
      <h1 className="fp-headline fp-headline--xl sheet-section-title">
        <EditableText value={title} onCommit={onTitle} />
      </h1>
      <p className="fp-deck">
        <EditableText rich value={deck} onCommit={onDeck} />
      </p>
      <div className="fp-byline">
        <EditableText value={byline} onCommit={onByline} />
      </div>
    </>
  );
}

export function ApplyCanvas({
  content,
  onCommit,
}: {
  content: ApplyContent;
  onCommit: (next: ApplyContent) => void;
}) {
  return (
    <>
      <EditableHeader
        title={content.title}
        deck={content.deck}
        byline={content.byline}
        onTitle={(title) => onCommit({ ...content, title })}
        onDeck={(deck) => onCommit({ ...content, deck })}
        onByline={(byline) => onCommit({ ...content, byline })}
      />

      <div className="sheet-apply-grid">
        <DimmedForms>
          <CouponForm {...APPLY_FORM} />
        </DimmedForms>

        <aside>
          <div className="sheet-notice">
            <div className="sheet-notice-head">
              <EditableText
                value={content.notice.head}
                onCommit={(head) =>
                  onCommit({ ...content, notice: { ...content.notice, head } })
                }
              />
            </div>
            <EditableBody
              className="fp-body"
              body={content.notice.paragraphs}
              pathPrefix="apply-notice"
              onChange={(paragraphs) =>
                onCommit({ ...content, notice: { ...content.notice, paragraphs } })
              }
            />
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
    </>
  );
}

export function JobsCanvas({
  content,
  onCommit,
}: {
  content: JobsContent;
  onCommit: (next: JobsContent) => void;
}) {
  return (
    <>
      <EditableHeader
        title={content.title}
        deck={content.deck}
        byline={content.byline}
        onTitle={(title) => onCommit({ ...content, title })}
        onDeck={(deck) => onCommit({ ...content, deck })}
        onByline={(byline) => onCommit({ ...content, byline })}
      />

      <div className="fp-row">
        {JOBS_FORMS.map((form) => (
          <DimmedForms key={form.title}>
            <CouponForm {...form} />
          </DimmedForms>
        ))}
      </div>
    </>
  );
}

export function DealsCanvas({
  content,
  onCommit,
}: {
  content: DealsContent;
  onCommit: (next: DealsContent) => void;
}) {
  return (
    <>
      <h1 className="fp-headline fp-headline--xl sheet-section-title">
        <EditableText
          value={content.title}
          onCommit={(title) => onCommit({ ...content, title })}
        />
        <span style={{ color: "#b78b39" }}>.</span>
      </h1>
      <p className="fp-deck">
        <EditableText
          rich
          value={content.deck}
          onCommit={(deck) => onCommit({ ...content, deck })}
        />
      </p>
      <div className="fp-byline">
        <EditableText
          value={content.byline}
          onCommit={(byline) => onCommit({ ...content, byline })}
        />
      </div>

      <div className="sheet-deals-grid">
        <div>
          <div className="sheet-notice">
            <div className="sheet-notice-head">
              <EditableText
                value={content.notice.head}
                onCommit={(head) =>
                  onCommit({ ...content, notice: { ...content.notice, head } })
                }
              />
            </div>
            <EditableBody
              className="fp-body"
              body={content.notice.paragraphs}
              pathPrefix="deals-notice"
              onChange={(paragraphs) =>
                onCommit({ ...content, notice: { ...content.notice, paragraphs } })
              }
            />
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

        <DimmedForms>
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
        </DimmedForms>
      </div>

      <div className="sheet-deals-ledger-head">
        <div className="fp-rule" />
        <div className="sheet-notice-head" style={{ margin: "18px 0 0" }}>
          <EditableText
            value={content.ledgerHead}
            onCommit={(ledgerHead) => onCommit({ ...content, ledgerHead })}
          />
        </div>
      </div>
      <div className="se-inert-form">
        <div className="se-archive-placeholder">
          Every published edition appears here automatically.
        </div>
        <div className="se-inert-badge">Archive — managed by the Blog</div>
      </div>
    </>
  );
}

// ── Read-only preview compositions (preview mode) ────────────────────────────

export function ApplyPreview({ content }: { content: ApplyContent }) {
  return (
    <>
      <SectionHeader title={content.title} deck={content.deck} byline={content.byline} />
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
    </>
  );
}

export function JobsPreview({ content }: { content: JobsContent }) {
  return (
    <>
      <SectionHeader title={content.title} deck={content.deck} byline={content.byline} />
      <div className="fp-row">
        {JOBS_FORMS.map((form) => (
          <CouponForm key={form.title} {...form} />
        ))}
      </div>
    </>
  );
}

export function DealsPreview({ content }: { content: DealsContent }) {
  return (
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
      archive={
        <div className="se-archive-placeholder">
          Every published edition appears here automatically.
        </div>
      }
    />
  );
}
