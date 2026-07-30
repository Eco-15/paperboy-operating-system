import type { Metadata } from "next";

// Public marketing site shell. Presents as "Paperboy Ventures" (the root
// layout's "Paperboy OS" branding is for the authenticated console).
export const metadata: Metadata = {
  title: {
    default: "Paperboy Ventures — Investing in Breakout Consumer Brands",
    template: "%s · Paperboy Ventures",
  },
  description:
    "Paperboy Ventures backs breakout consumer brands — better-for-you snacks, functional beverages, and the next generation of pantry staples.",
  openGraph: {
    siteName: "Paperboy Ventures",
    type: "website",
  },
};

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site">
      <main className="site-main">{children}</main>
    </div>
  );
}
