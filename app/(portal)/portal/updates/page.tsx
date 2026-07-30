import Link from "next/link";
import { requirePortalUser } from "@/lib/auth/guards";
import { listPublishedUpdates } from "@/lib/portal/data";
import { excerpt, fmtDate } from "@/lib/portal/format";

export const metadata = { title: "Updates — Paperboy Ventures" };

export default async function PortalUpdatesPage() {
  await requirePortalUser();
  const updates = await listPublishedUpdates();

  return (
    <>
      <div className="lp-kicker">Investor updates</div>
      <h1 className="lp-title">Letters from Paperboy</h1>
      <p className="lp-sub">Periodic updates on the fund, the portfolio, and what we&apos;re seeing.</p>

      <section className="lp-section">
        {updates.length === 0 ? (
          <div className="lp-empty">Nothing published yet — updates will land here.</div>
        ) : (
          <div className="lp-grid">
            {updates.map((u) => (
              <Link className="lp-card lp-card--link" key={u.id} href={`/portal/updates/${u.id}`}>
                <div className="lp-card-kicker">{fmtDate(u.publishedAt)}</div>
                <div className="lp-card-title">{u.title}</div>
                <div className="lp-card-body">{excerpt(u.body)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
