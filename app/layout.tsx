import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import {
  DENSITY_COOKIE,
  MOTION_COOKIE,
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
} from "@/lib/prefs/cookies";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paperboy OS",
  description: "The Paperboy operating system — investment, talent, and media in one place.",
  // Installed-app identity (the manifest in app/manifest.ts covers Android/Chrome;
  // these cover iOS "Add to Home Screen").
  appleWebApp: {
    capable: true,
    title: "Paperboy",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1713" },
  ],
  // Edge-to-edge on notched phones; the mobile shell pads with safe-area insets.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Appearance is mirrored into cookies (DB is the source of truth) so we can
  // paint the right palette on the first frame with no DB hit. "system" can't be
  // resolved on the server, so THEME_INIT_SCRIPT settles it before paint —
  // hence suppressHydrationWarning on <html>.
  const jar = await cookies();
  const theme = jar.get(THEME_COOKIE)?.value;
  const density = jar.get(DENSITY_COOKIE)?.value === "compact" ? "compact" : "comfortable";
  const reduceMotion = jar.get(MOTION_COOKIE)?.value === "1";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={theme === "dark" ? "dark" : "light"}
      data-density={density}
      data-reduce-motion={reduceMotion ? "true" : "false"}
    >
      <head>
        {/* Same fonts as the original dashboard prototype */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Ubuntu+Mono:wght@400;700&family=DM+Sans:wght@400;500&family=Courier+Prime:wght@400;700&family=UnifrakturCook:wght@700&family=Playfair+Display:wght@700;900&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
