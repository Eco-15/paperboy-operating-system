import { requirePortalUser } from "@/lib/auth/guards";
import { listVisiblePortfolio } from "@/lib/portal/data";

export const metadata = { title: "Portfolio — Paperboy Ventures" };

export default async function PortalPortfolioPage() {
  await requirePortalUser();
  const companies = await listVisiblePortfolio();
  const active = companies.filter((c) => c.status !== "exited");
  const exited = companies.filter((c) => c.status === "exited");

  return (
    <>
      <div className="lp-kicker">The portfolio</div>
      <h1 className="lp-title">What we&apos;ve backed</h1>
      <p className="lp-sub">The companies Paperboy Ventures has invested in.</p>

      {companies.length === 0 && (
        <section className="lp-section">
          <div className="lp-empty">Portfolio companies will appear here.</div>
        </section>
      )}

      {[
        { label: "Active", list: active },
        { label: "Exited", list: exited },
      ]
        .filter((s) => s.list.length > 0)
        .map((s) => (
          <section className="lp-section" key={s.label}>
            <div className="lp-section-head">
              <div className="lp-section-title">{s.label}</div>
            </div>
            <div className="lp-grid">
              {s.list.map((c) => (
                <div className="lp-card" key={c.id}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    {c.logoUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img className="lp-portfolio-logo" src={c.logoUrl} alt={c.name} />
                    )}
                    <div>
                      <div className="lp-card-title">{c.name}</div>
                      <div className="lp-doc-meta">
                        {[c.category, c.investedOn].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  {c.description && <div className="lp-card-body">{c.description}</div>}
                  {c.highlight && (
                    <div style={{ marginTop: 10 }}>
                      <span className="lp-tag">{c.highlight}</span>
                    </div>
                  )}
                  {c.website && (
                    <div style={{ marginTop: 12 }}>
                      <a
                        className="lp-see-all"
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Visit site →
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
    </>
  );
}
