import type { ReactNode } from "react";
import { isStaff, requirePortalUser } from "@/lib/auth/guards";
import { PortalNav, PortalSignOut } from "@/components/portal/PortalChrome";

// The LP-facing investor portal. Separate route group so investors never see
// the internal console shell — this is a clean, editorial, investor-grade
// surface. Staff may enter to preview what LPs see.
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requirePortalUser();

  return (
    <div className="lp-root">
      <header className="lp-masthead">
        <div className="lp-masthead-inner">
          <div className="lp-masthead-top">
            <div className="lp-wordmark">
              Paperboy Ventures
              <span className="lp-wordmark-sub">Investor Relations</span>
            </div>
            <PortalSignOut label={user.name || user.email} />
          </div>
          <PortalNav />
        </div>
      </header>
      <main className="lp-main">
        {isStaff(user.role) && (
          <div className="lp-banner">
            Staff preview — you are viewing the investor portal as staff, so every
            document is visible. LPs only see what has been shared with them.
          </div>
        )}
        {children}
      </main>
      <footer className="lp-footer">
        Paperboy Ventures · Confidential — for limited partners only
      </footer>
    </div>
  );
}
