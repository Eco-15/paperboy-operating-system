import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/marketing/brand";

// One route = one broadsheet sheet. The masthead and folio ARE the site
// chrome: article headlines inside `children` are the navigation, and the
// members' sign-in hides as plain folio text (no web header, no index line).
// On section pages the wordmark links back to the front page.
export default function Sheet({
  section,
  kicker,
  children,
  isFront: isFrontProp,
}: {
  section: string;
  kicker?: string;
  children: React.ReactNode;
  // Explicit front-page flag (pass slug === "home"); the section label is
  // editable now, so deriving from its text is only a fallback.
  isFront?: boolean;
}) {
  const isFront = isFrontProp ?? section === "Front Page";
  return (
    <div className={"sheet" + (isFront ? "" : " sheet--section")}>
      <div className="sheet-folio">
        <span>Est. 2026 · New York</span>
        <span>{section}</span>
        <Link href="/login">Members&apos; Entrance</Link>
      </div>
      {isFront ? (
        <h1 className="sheet-wordmark">{SITE_NAME}</h1>
      ) : (
        <div className="sheet-wordmark">
          <Link href="/">{SITE_NAME}</Link>
        </div>
      )}
      {kicker ? <div className="sheet-kicker">{kicker}</div> : null}
      <div className="fp-rule" />
      <main className="sheet-body">{children}</main>
      <div className="sheet-colophon">
        © 2026 {SITE_NAME} · Printed daily · Price: Free ·{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </div>
    </div>
  );
}
