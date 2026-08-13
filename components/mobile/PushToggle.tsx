"use client";

// "Notify me about new deals" — the switch that registers this device for
// lock-screen push.
//
// Two platform rules drive the shape of this component:
//   1. Notification.requestPermission() must be called from a real user gesture
//      or Safari rejects it outright. Hence a button, never an on-mount effect.
//   2. On iOS, Web Push exists ONLY for a PWA installed to the home screen.
//      In a Safari tab the APIs are absent, so we explain that rather than
//      showing a button that silently does nothing.
import { useCallback, useEffect, useState } from "react";
import { BellIcon } from "./icons";
import s from "./mobile.module.css";

/**
 * base64url (VAPID public key) → BufferSource, as the Push API requires.
 * Backed by an explicit ArrayBuffer: TS types applicationServerKey as
 * ArrayBufferView<ArrayBuffer>, which a plain Uint8Array (ArrayBufferLike)
 * doesn't satisfy.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

type State =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "off"
  | "on"
  | "blocked"
  | "no-sw";

/**
 * `navigator.serviceWorker.ready` never settles when no worker is registered —
 * it waits forever rather than rejecting. Racing it against a timeout keeps a
 * missing/failed registration from hanging the UI silently.
 */
async function readyWithin(ms: number): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null);
}

export default function PushToggle({
  publicKey,
  showToast,
}: {
  publicKey: string;
  showToast: (msg: string) => void;
}) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        // iOS Safari exposes none of this until the app is on the home screen.
        const iOS = /iP(hone|ad|od)/.test(navigator.userAgent);
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true;
        if (alive) setState(iOS && !standalone ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (alive) setState("blocked");
        return;
      }
      // The service worker registers itself on load (RegisterSW), but only in
      // production builds — and registration can simply fail. Say so rather
      // than rendering nothing.
      const reg = await readyWithin(4000);
      if (!reg) {
        if (alive) setState("no-sw");
        return;
      }
      const sub = await reg.pushManager.getSubscription().catch(() => null);
      if (alive) setState(sub ? "on" : "off");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      // Must be inside the click handler's task for Safari to honour it.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await readyWithin(8000);
      if (!reg) {
        setState("no-sw");
        showToast("Notifications aren't available yet — reopen the app");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBuffer(publicKey),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `test: true` fires one push straight back so the user gets immediate
        // proof it works, instead of waiting days for the next application.
        body: JSON.stringify({ ...sub.toJSON(), test: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("on");
      showToast("Notifications on");
    } catch {
      showToast("Couldn't turn on notifications");
      setState("off");
    } finally {
      setBusy(false);
    }
  }, [publicKey, showToast]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await readyWithin(8000);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
      showToast("Notifications off");
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  if (state === "checking") return null;

  if (state === "needs-install") {
    return (
      <p className={s.pushNote}>
        <BellIcon /> To get alerts for new deals, add Paperboy to your home screen first
        (Share → Add to Home Screen), then open it from there.
      </p>
    );
  }
  if (state === "unsupported") {
    return (
      <p className={s.pushNote}>
        <BellIcon /> This browser can&rsquo;t do notifications.
      </p>
    );
  }
  if (state === "blocked") {
    return (
      <p className={s.pushNote}>
        <BellIcon /> Notifications are blocked for Paperboy. Turn them back on in your
        phone&rsquo;s Settings → Notifications.
      </p>
    );
  }
  if (state === "no-sw") {
    return (
      <p className={s.pushNote}>
        <BellIcon /> Notifications need the installed app. Close Paperboy and reopen it
        from your home screen — if this keeps showing, reinstall it.
      </p>
    );
  }

  const on = state === "on";
  return (
    <button
      type="button"
      className={`${s.pushRow}${on ? ` ${s.pushRowOn}` : ""} ${s.press}`}
      onClick={() => void (on ? disable() : enable())}
      disabled={busy}
      aria-pressed={on}
    >
      <BellIcon />
      <span className={s.pushLabel}>
        <span className={s.pushTitle}>{on ? "Notifications on" : "Notify me about new deals"}</span>
        <span className={s.pushSub}>
          {busy
            ? "One moment…"
            : on
              ? "You'll get an alert when an application comes in"
              : "Get an alert when a new application comes in"}
        </span>
      </span>
      <span className={`${s.pushSwitch}${on ? ` ${s.pushSwitchOn}` : ""}`} aria-hidden="true" />
    </button>
  );
}
