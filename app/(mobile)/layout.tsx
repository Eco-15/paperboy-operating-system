import type { ReactNode } from "react";
import type { Viewport } from "next";
import RegisterSW from "@/components/mobile/RegisterSW";

// Minimal server layout for the phone shell (/m). Auth is enforced by
// middleware + the page's requireRole guard — this layout only provides the
// PWA viewport (viewport-fit=cover unlocks env(safe-area-inset-*) on iPhone;
// maximumScale=1 stops Safari's auto-zoom on input focus) and registers the
// service worker. The manifest/icons are wired elsewhere.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#171512" },
  ],
};

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {children}
      <RegisterSW />
    </div>
  );
}
