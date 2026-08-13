"use client";

// The mobile app shell. As of 2026-07 the phone app IS the Investment CRM —
// the old Route / Network / Desk tabs are gone, so there is one screen, no tab
// bar, and one data source (/api/crm). The account sheet carries what the Desk
// tab used to: who's signed in, doors into the full OS, and sign out.
import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import type { Deal } from "@/lib/crm/types";
import {
  nextSortState,
  parseSortState,
  SORT_COLUMNS,
  type SortCol,
  type SortState,
} from "@/lib/crm/sort";
import CrmTab from "./CrmTab";
import { useRemote, type CrmPayload, type LiteDeal } from "./data";
import DealSheet, { type DealRequest } from "./DealSheet";
import { ChevronIcon, SignOutIcon } from "./icons";
import PushToggle from "./PushToggle";
import Sheet from "./Sheet";
import s from "./mobile.module.css";

/** The sort survives app restarts — it's a preference, not a session detail. */
const SORT_KEY = "crm:sort";

const OS_LINKS = [
  { href: "/crm", label: "Full CRM", sub: "Board & table" },
  { href: "/dashboard", label: "Paperboy OS", sub: "Everything else" },
] as const;

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function MobileShell({
  user,
  vapidPublicKey,
}: {
  user: { name: string | null; email: string | null };
  /** Empty when push isn't configured on this server — the toggle hides. */
  vapidPublicKey: string;
}) {
  const [standalone, setStandalone] = useState(false);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const crm = useRemote<CrmPayload>("/api/crm?view=all&lite=1");

  // Sheets.
  const [dealReq, setDealReq] = useState<DealRequest | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [sort, setSort] = useState<SortState>(null);

  // Restore the persisted sort after mount (no localStorage on the server).
  // `hydrated` gates the writer: without it, it would run on the same commit
  // as this reader — still holding the initial null — and clear the stored
  // sort before the restore landed.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SORT_KEY);
      if (raw) setSort(parseSortState(JSON.parse(raw)));
    } catch {
      /* private mode / corrupt value — fall back to newest-first */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (sort) window.localStorage.setItem(SORT_KEY, JSON.stringify(sort));
      else window.localStorage.removeItem(SORT_KEY);
    } catch {
      /* noop */
    }
  }, [sort, hydrated]);

  // Installed-PWA detection → standalone-only styling.
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const sync = () =>
      setStandalone(mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  // Offline banner.
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const openDeal = useCallback((deal: LiteDeal) => {
    setDealReq({ id: deal.id, seed: deal });
  }, []);

  // Optimistic edits made in the DealSheet flow back into the shared list.
  const crmMutate = crm.mutate;
  const onDealPatched = useCallback(
    (deal: Deal | LiteDeal) => {
      crmMutate((data) => ({
        ...data,
        deals: data.deals.map((d) =>
          d.id === deal.id
            ? { ...d, stage: deal.stage, priority: deal.priority, fund: deal.fund, archived: deal.archived }
            : d,
        ),
      }));
    },
    [crmMutate],
  );

  // ── "New since you last looked" ─────────────────────────────────────────
  // The list comes from the server (per-user watermark); acknowledging it is a
  // deliberate act, so a pull-to-refresh can't quietly clear it.
  const newIds = crm.state.data?.newIds ?? [];
  const newSince = crm.state.data?.newSince ?? null;

  const pendingAck = useRef(false);
  useEffect(() => {
    pendingAck.current = newIds.length > 0;
  }, [newIds]);

  useEffect(() => {
    // The installed app is usually backgrounded rather than closed, so pagehide
    // is the reliable "they're done looking" signal. Not on unmount — opening a
    // deal sheet and coming back must not silently clear the tray.
    const flush = () => {
      if (!pendingAck.current) return;
      pendingAck.current = false;
      navigator.sendBeacon?.("/api/crm/seen");
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const acknowledgeNew = useCallback(() => {
    pendingAck.current = false;
    crmMutate((data) => ({ ...data, newIds: [], newSince: new Date().toISOString() }));
    void fetch("/api/crm/seen", { method: "POST" })
      .then(() => showToast("Caught up"))
      .catch(() => {
        /* the beacon on pagehide is the backstop */
      });
  }, [crmMutate, showToast]);

  const refresh = useCallback(async () => {
    await crm.reload();
  }, [crm.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`${s.shell}${standalone ? ` ${s.standalone}` : ""}`}>
      <div className={s.scrim} />
      {!online ? <div className={s.offline}>Offline — showing cached data</div> : null}

      <CrmTab
        crm={crm.state}
        retry={() => void crm.reload()}
        openDeal={openDeal}
        onRefresh={refresh}
        openAccount={() => setAcctOpen(true)}
        openSort={() => setSortOpen(true)}
        sort={sort}
        newIds={newIds}
        newSince={newSince}
        onAcknowledgeNew={acknowledgeNew}
      />

      {/* ── Sort sheet ───────────────────────────────────────── */}
      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort">
        <div className={s.sortList}>
          <button
            type="button"
            className={`${s.sortOpt}${sort === null ? ` ${s.sortOptActive}` : ""} ${s.press}`}
            onClick={() => {
              setSort(null);
              setSortOpen(false);
            }}
          >
            <span>Newest first</span>
            <span className={s.sortDir}>{sort === null ? "✓" : ""}</span>
          </button>
          {SORT_COLUMNS.map(({ col, label }) => {
            const active = sort?.col === col;
            return (
              <button
                key={col}
                type="button"
                className={`${s.sortOpt}${active ? ` ${s.sortOptActive}` : ""} ${s.press}`}
                // Tapping the active column flips the direction, then clears —
                // the same desc → asc → off cycle as the desktop headers.
                onClick={() => setSort((cur) => nextSortState(cur, col as SortCol))}
              >
                <span>{label}</span>
                <span className={s.sortDir}>{active ? (sort.dir === "asc" ? "↑ A–Z" : "↓ Z–A") : ""}</span>
              </button>
            );
          })}
        </div>
        <p className={s.sortHint}>Tap a column again to flip the direction, once more to clear it.</p>
      </Sheet>

      {/* ── Account sheet (what the Desk tab used to hold) ────── */}
      <Sheet open={acctOpen} onClose={() => setAcctOpen(false)} title="Account">
        <div className={s.userCard}>
          <div className={s.avatar}>{initials(user.name, user.email)}</div>
          <div style={{ minWidth: 0 }}>
            <div className={s.userName}>{user.name || "Paperboy staff"}</div>
            {user.email ? <div className={s.userEmail}>{user.email}</div> : null}
          </div>
        </div>

        {vapidPublicKey ? (
          <PushToggle publicKey={vapidPublicKey} showToast={showToast} />
        ) : null}

        <div className={s.tileGrid}>
          {OS_LINKS.map(({ href, label, sub }) => (
            <a key={href} href={href} className={`${s.tile} ${s.press}`}>
              <span>
                <span className={s.tileLabel}>{label}</span>
                <span className={s.tileSub} style={{ display: "block" }}>
                  {sub}
                </span>
              </span>
              <span className={s.tileChevron}>
                <ChevronIcon />
              </span>
            </a>
          ))}
        </div>

        <button
          type="button"
          className={`${s.signOutRow} ${s.press}`}
          onClick={() => void signOut({ callbackUrl: "/login" })}
        >
          <SignOutIcon />
          Sign out
        </button>

        <div className={s.deskFoot}>Paperboy OS · Mobile</div>
      </Sheet>

      {/* ── Deal sheet ───────────────────────────────────────── */}
      <DealSheet
        req={dealReq}
        onClose={() => setDealReq(null)}
        onPatched={onDealPatched}
        showToast={showToast}
      />

      {toast ? <div className={s.toast}>{toast}</div> : null}
    </div>
  );
}
