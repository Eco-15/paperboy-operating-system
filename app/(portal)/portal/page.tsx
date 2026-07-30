import Link from "next/link";
import { requirePortalUser } from "@/lib/auth/guards";
import {
  getLpForUser,
  listPublishedUpdates,
  listVisibleDocuments,
  listVisiblePortfolio,
} from "@/lib/portal/data";
import { excerpt, fmtDate, fmtUsd } from "@/lib/portal/format";

export const metadata = { title: "Investor Portal — Paperboy Ventures" };

export default async function PortalOverviewPage() {
  const user = await requirePortalUser();
  const lp = await getLpForUser(user);
  const [updates, docs, portfolio] = await Promise.all([
    listPublishedUpdates(),
    listVisibleDocuments(user, lp),
    listVisiblePortfolio(),
  ]);
  const latest = updates[0];
  const firstName =
    (lp?.contactName || user.name || "")?.split(" ")[0] || "Investor";
  const committed = lp?.commitmentUsd ?? null;
  const invested = lp?.investedUsd ?? null;
  const pct =
    committed && invested != null && committed > 0
      ? Math.min(100, Math.round((invested / committed) * 100))
      : null;

  return (
    <>
      <div className="lp-kicker">{lp?.entityName ?? "Welcome"}</div>
      <h1 className="lp-title">Good to see you, {firstName}.</h1>
      <p className="lp-sub">
        Your private window into Paperboy Ventures — updates from Kyle, your
        documents, and the portfolio.
      </p>

      <section className="lp-section">
        <div className="lp-grid">
          <div className="lp-card">
            <div className="lp-card-kicker">Your position</div>
            {lp && committed != null ? (
              <>
                <div className="lp-stat-row">
                  <div>
                    <div className="lp-stat">{fmtUsd(committed)}</div>
                    <div className="lp-stat-label">Committed</div>
                  </div>
                  <div>
                    <div className="lp-stat">{fmtUsd(invested ?? 0)}</div>
                    <div className="lp-stat-label">Called to date</div>
                  </div>
                </div>
                {pct != null && (
                  <>
                    <div className="lp-bar">
                      <div className="lp-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="lp-card-body">{pct}% of your commitment called.</div>
                  </>
                )}
              </>
            ) : (
              <div className="lp-card-body">
                Your commitment details haven&apos;t been added yet. Reach out to the
                Paperboy team if anything looks off.
              </div>
            )}
          </div>

          {latest ? (
            <Link className="lp-card lp-card--link" href={`/portal/updates/${latest.id}`}>
              <div className="lp-card-kicker">Latest update · {fmtDate(latest.publishedAt)}</div>
              <div className="lp-card-title">{latest.title}</div>
              <div className="lp-card-body">{excerpt(latest.body)}</div>
            </Link>
          ) : (
            <div className="lp-card">
              <div className="lp-card-kicker">Updates</div>
              <div className="lp-card-body">No investor updates published yet.</div>
            </div>
          )}

          <div className="lp-card">
            <div className="lp-card-kicker">Portfolio</div>
            <div className="lp-stat">{portfolio.length}</div>
            <div className="lp-stat-label">Companies</div>
            {portfolio.length > 0 && (
              <div className="lp-card-body">
                {portfolio
                  .slice(0, 4)
                  .map((c) => c.name)
                  .join(" · ")}
                {portfolio.length > 4 ? " · …" : ""}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <Link className="lp-btn" href="/portal/portfolio">
                View portfolio
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <div className="lp-section-title">Recent documents</div>
          <Link className="lp-see-all" href="/portal/documents">
            All documents →
          </Link>
        </div>
        {docs.length === 0 ? (
          <div className="lp-empty">No documents have been shared with you yet.</div>
        ) : (
          docs.slice(0, 4).map((d) => (
            <div className="lp-doc-row" key={d.id}>
              <div>
                <div className="lp-doc-name">{d.title}</div>
                <div className="lp-doc-meta">{fmtDate(d.createdAt)}</div>
              </div>
              <a className="lp-btn" href={`/api/portal/documents/${d.id}/download`}>
                {d.externalUrl ? "Open" : "Download"}
              </a>
            </div>
          ))
        )}
      </section>
    </>
  );
}
