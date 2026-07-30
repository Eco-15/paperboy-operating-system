import { requirePortalUser } from "@/lib/auth/guards";
import { getLpForUser, listVisibleDocuments } from "@/lib/portal/data";
import { DOC_CATEGORIES, fmtBytes, fmtDate } from "@/lib/portal/format";

export const metadata = { title: "Documents — Paperboy Ventures" };

export default async function PortalDocumentsPage() {
  const user = await requirePortalUser();
  const lp = await getLpForUser(user);
  const docs = await listVisibleDocuments(user, lp);

  const groups = DOC_CATEGORIES.map((c) => ({
    ...c,
    docs: docs.filter((d) => d.category === c.key),
  })).filter((g) => g.docs.length > 0);

  return (
    <>
      <div className="lp-kicker">Data room</div>
      <h1 className="lp-title">Documents</h1>
      <p className="lp-sub">
        Reports, financials, and materials shared with you by the Paperboy team.
      </p>

      {docs.length === 0 ? (
        <section className="lp-section">
          <div className="lp-empty">No documents have been shared with you yet.</div>
        </section>
      ) : (
        groups.map((g) => (
          <section className="lp-section" key={g.key}>
            <div className="lp-section-head">
              <div className="lp-section-title">{g.label}</div>
            </div>
            {g.docs.map((d) => (
              <div className="lp-doc-row" key={d.id}>
                <div>
                  <div className="lp-doc-name">{d.title}</div>
                  <div className="lp-doc-meta">
                    {fmtDate(d.createdAt)}
                    {d.size ? ` · ${fmtBytes(d.size)}` : ""}
                    {d.externalUrl ? " · external link" : ""}
                  </div>
                </div>
                <a className="lp-btn" href={`/api/portal/documents/${d.id}/download`}>
                  {d.externalUrl ? "Open" : "Download"}
                </a>
              </div>
            ))}
          </section>
        ))
      )}
    </>
  );
}
