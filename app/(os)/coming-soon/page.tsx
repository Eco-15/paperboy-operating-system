import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";

// Honest placeholder for tiles that are on the roadmap but not built yet
// (Talent CRM, Matching, Content Studio). Linked from the dashboard so every
// tile is clickable; the `feature` query param personalizes the message.
export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  await requireUser();
  const { feature } = await searchParams;
  const name = feature?.trim() || "This tool";

  return (
    <>
      <main className="tool-main">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: "52vh",
            gap: "0.9rem",
            padding: "2rem 1rem",
          }}
        >
          <span
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              opacity: 0.55,
            }}
          >
            In progress
          </span>
          <h1 style={{ fontSize: "1.9rem", margin: 0 }}>{name} is coming soon</h1>
          <p style={{ maxWidth: 440, opacity: 0.7, lineHeight: 1.55, margin: 0 }}>
            We&apos;re building this out. It&apos;s on the Paperboy OS roadmap — check
            back shortly, or ask in the chat if you need something from it now.
          </p>
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.4rem", flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/dashboard"
              style={{
                padding: "0.55rem 1rem",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                textDecoration: "none",
                color: "inherit",
                fontSize: "0.9rem",
              }}
            >
              ← Back to dashboard
            </Link>
            <Link
              href="/chat"
              style={{
                padding: "0.55rem 1rem",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              Ask Paperboy
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
