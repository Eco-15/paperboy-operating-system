/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import FrontPagePaper from "@/components/marketing/FrontPagePaper";
import LoaderPreviews from "@/components/marketing/LoaderPreviews";

// Temporary internal brand-kit / asset review page. Not linked from the site
// and excluded from search. A scratch surface for reviewing generated assets
// (e.g. the Paperboy-style team portraits) — more sections to come.
export const metadata: Metadata = {
  title: "Brand Kit — Paperboy",
  robots: { index: false, follow: false },
};

const STYLES = ["Hedcut stipple engraving", "Bold woodcut engraving", "Loose pen-and-ink"];

const HAT = STYLES.map((style, i) => ({ style, src: `/team/kyle-paperboy-${i + 1}.png` }));
const NOHAT = STYLES.map((style, i) => ({ style, src: `/team/kyle-nohat-${i + 1}.png` }));

function Cut({ src, label }: { src: string; label: string }) {
  return (
    <figure style={s.figure}>
      <div style={s.cut}>
        <img src={src} alt={label} style={s.img} />
      </div>
      <figcaption style={s.cap}>
        <span style={s.capLabel}>{label}</span>
        <code style={s.code}>{src}</code>
      </figcaption>
    </figure>
  );
}

const LOGOS = [
  { brand: "Toto", raw: "/front-page/logos/toto.png", eng: "/front-page/logos-engraved/toto.png", rawBg: "#fff" },
  { brand: "Cheddies", raw: "/front-page/logos/cheddies.png", eng: "/front-page/logos-engraved/cheddies.png", rawBg: "#fff" },
  { brand: "Just Date", raw: "/front-page/logos/just-date.png", eng: "/front-page/logos-engraved/just-date.png", rawBg: "#fff" },
  { brand: "Waku", raw: "/front-page/logos/waku.png", eng: "/front-page/logos-engraved/waku.png", rawBg: "#15110c" },
];

function LogoCard({ brand, raw, eng, rawBg }: { brand: string; raw: string; eng: string; rawBg: string }) {
  return (
    <div style={s.logoCard}>
      <div style={s.logoBrand}>{brand}</div>
      <div style={s.logoPair}>
        <figure style={s.figure}>
          <div style={{ ...s.logoTile, background: rawBg }}>
            <img src={raw} alt={`${brand} logo`} style={s.logoImg} />
          </div>
          <figcaption style={s.cap}>
            <span style={s.capLabel}>Raw logo</span>
          </figcaption>
        </figure>
        <figure style={s.figure}>
          <div style={{ ...s.logoTile, background: "#f1ebde" }}>
            <img src={eng} alt={`${brand} engraved`} style={s.logoImg} />
          </div>
          <figcaption style={s.cap}>
            <span style={s.capLabel}>Higgsfield engraved</span>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

export default function BrandKitPage() {
  return (
    <main style={s.wrap}>
      <header style={s.head}>
        <div style={s.kicker}>Paperboy · Brand Kit</div>
        <h1 style={s.h1}>Brand Kit</h1>
        <p style={s.sub}>
          Temporary working page — assets in progress, not linked from the live
          site.
        </p>
      </header>

      <section style={s.section}>
        <h2 style={s.h2}>
          Loading Page <span style={s.tag}>two concepts, side by side</span>
        </h2>
        <LoaderPreviews />
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>
          Team Portraits — Kyle <span style={s.tag}>Paperboy style</span>
        </h2>

        <div style={s.groupHead}>With newsboy cap</div>
        <div style={s.row3}>
          {HAT.map((p) => (
            <Cut key={p.src} src={p.src} label={p.style} />
          ))}
        </div>

        <div style={{ ...s.groupHead, marginTop: 36 }}>No hat</div>
        <div style={s.row3}>
          {NOHAT.map((p) => (
            <Cut key={p.src} src={p.src} label={p.style} />
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>
          Portfolio Logos <span style={s.tag}>raw vs engraved</span>
        </h2>
        <div style={s.logoGrid}>
          {LOGOS.map((l) => (
            <LogoCard key={l.brand} {...l} />
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>
          The Front Page <span style={s.tag}>newspaper concept</span>
        </h2>
        <FrontPagePaper />
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Source</h2>
        <div style={{ ...s.row3, maxWidth: 280 }}>
          <Cut src="/team/kyle-original.jpg" label="Original headshot" />
        </div>
      </section>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    background: "#F5F2E8",
    color: "#15110c",
    padding: "clamp(28px, 5vw, 64px)",
    fontFamily: "'Old Standard TT', Georgia, serif",
  },
  head: { borderBottom: "1px solid #e5e0d0", paddingBottom: 22, marginBottom: 36 },
  kicker: {
    fontFamily: "'Courier Prime', monospace",
    fontSize: 12,
    letterSpacing: ".22em",
    textTransform: "uppercase",
    color: "#6b6453",
  },
  h1: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontWeight: 900,
    fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
    letterSpacing: "-.02em",
    margin: "8px 0 6px",
  },
  sub: { fontFamily: "'Courier Prime', monospace", fontSize: 13, color: "#9b9580" },
  section: { marginBottom: 48 },
  h2: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 500,
    fontSize: "1.2rem",
    letterSpacing: "-.02em",
    marginBottom: 22,
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  tag: {
    fontFamily: "'Courier Prime', monospace",
    fontSize: 11,
    letterSpacing: ".1em",
    textTransform: "uppercase",
    color: "#6b6453",
    border: "1px solid #d9d3c2",
    borderRadius: 99,
    padding: "3px 10px",
  },
  groupHead: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: "#6b6453",
    paddingBottom: 8,
    marginBottom: 16,
    borderBottom: "1px solid #e5e0d0",
  },
  row3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 24,
  },
  figure: { margin: 0 },
  cut: {
    background: "#f4efe1",
    border: "1px solid rgba(21,17,12,.6)",
    padding: 10,
    boxShadow: "0 8px 30px rgba(0,0,0,.08)",
  },
  img: { width: "100%", height: "auto", display: "block" },
  cap: { display: "flex", flexDirection: "column", gap: 3, marginTop: 12 },
  capLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5, color: "#15110c" },
  code: { fontFamily: "'Courier Prime', monospace", fontSize: 11.5, color: "#9b9580" },
  logoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 28 },
  logoCard: { border: "1px solid #e5e0d0", borderRadius: 12, padding: 18, background: "#fbf9f2" },
  logoBrand: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, marginBottom: 12, color: "#15110c" },
  logoPair: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  logoTile: {
    aspectRatio: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    border: "1px solid #e5e0d0",
    borderRadius: 8,
    overflow: "hidden",
  },
  logoImg: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
};
