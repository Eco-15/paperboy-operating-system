"use client";

// Registers the handwritten service worker (public/sw.js). Production only —
// a dev SW would cache stale HMR chunks — and defensively wrapped: a failed
// registration must never take the shell down.
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline shell is a progressive enhancement — never crash */
      });
    } catch {
      /* noop */
    }
  }, []);
  return null;
}
