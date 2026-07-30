import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Sheet from "@/components/site/Sheet";
import SectionHeader from "@/components/site/broadsheet/SectionHeader";
import RsvpCoupon from "@/components/events/RsvpCoupon";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { formatEventDate } from "@/lib/events/types";

// Public event page + RSVP coupon, in the paper's broadsheet voice. Events
// read per request so a status flip (draft → live → complete) shows
// immediately.
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

async function getEvent(slug: string) {
  const [row] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  return row ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Events" };
  return {
    title: event.name,
    description: event.description ?? `RSVP for ${event.name}.`,
  };
}

export default async function PublicEventPage({ params }: { params: Params }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const dateLine = formatEventDate(event.date ? event.date.toISOString() : null);
  const venueLine = event.venue && event.venue !== "TBA" ? event.venue : "Venue to be announced";
  const closed = event.status === "complete";
  const paragraphs = (event.description ?? "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Sheet section="Events" kicker="An Invitation from the Publisher" isFront={false}>
      <SectionHeader
        title={event.name}
        deck={`${dateLine} · ${venueLine}`}
        byline="Attendance by approval · No tickets, no fees — just the right room"
      />

      {paragraphs.length > 0 && (
        <div className="fp-body" style={{ maxWidth: 720, margin: "0 auto 26px" }}>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      <div className="sheet-apply-grid">
        {closed ? (
          <div className="sheet-coupon sheet-coupon--done">
            <div className="sheet-coupon-title">Request an Invitation</div>
            <p className="sheet-coupon-success">
              This edition of the Invitational has wrapped — watch this page for the next one.
            </p>
          </div>
        ) : (
          <RsvpCoupon slug={event.slug} />
        )}

        <aside>
          <div className="sheet-notice">
            <div className="sheet-notice-head">Notices</div>
            <div className="fp-body">
              <p>
                <strong>The tournament.</strong> A scramble in foursomes — check the box on your
                RSVP if you&apos;d like a spot on the course. Non-players are warmly expected for
                the nineteenth hole.
              </p>
              <p>
                <strong>The guest list.</strong> Seats are limited and confirmed personally.
                You&apos;ll hear from the Paperboy team once your RSVP is reviewed.
              </p>
              <p>
                <strong>Sponsorships.</strong> One title slot and three secondary slots are
                offered for this edition. Write to the publisher for the packet.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </Sheet>
  );
}
