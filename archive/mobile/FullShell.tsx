"use client";

// The mobile app shell. All four tabs are mounted at once (visibility
// toggling, never unmounted) so switches are instant and every tab keeps its
// scroll position + filters. Tab changes rewrite the URL with replaceState —
// the back button never walks tab history — and ride View Transitions where
// the browser has them. Sheets (news story, person, deal) live here so any
// tab can open them, and they stack.
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Deal } from "@/lib/crm/types";
import {
  useLatched,
  useRemote,
  type CrmPayload,
  type EventsPayload,
  type LiteDeal,
  type NetworkPayload,
  type NewsItem,
  type NewsPayload,
  type Person,
} from "./data";
import DealSheet, { type DealRequest } from "./DealSheet";
import DeskTab from "./DeskTab";
import { ExternalIcon, GridIcon, KanbanIcon, MailIcon, NewspaperIcon, PeopleIcon } from "./icons";
import NetworkTab from "./NetworkTab";
import PipelineTab, { type PipelinePreset } from "./PipelineTab";
import RouteTab, { type PipelineJump } from "./RouteTab";
import Sheet from "./Sheet";
import s from "./mobile.module.css";

export type MobileTab = "route" | "pipeline" | "network" | "desk";

const TAB_META: { id: MobileTab; label: string; Icon: typeof NewspaperIcon }[] = [
  { id: "route", label: "Route", Icon: NewspaperIcon },
  { id: "pipeline", label: "Pipeline", Icon: KanbanIcon },
  { id: "network", label: "Network", Icon: PeopleIcon },
  { id: "desk", label: "Desk", Icon: GridIcon },
];

export default function MobileShell({
  initialTab,
  user,
}: {
  initialTab: MobileTab;
  user: { name: string | null; email: string | null };
}) {
  const [tab, setTab] = useState<MobileTab>(initialTab);
  const tabRef = useRef(tab);
  const [standalone, setStandalone] = useState(false);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // Shared data: CRM feeds both Route (desk rows + strip) and Pipeline.
  const news = useRemote<NewsPayload>("/api/dashboard/news");
  const crm = useRemote<CrmPayload>("/api/crm?view=all&lite=1");
  const events = useRemote<EventsPayload>("/api/events");
  const network = useRemote<NetworkPayload>("/api/network");

  // Sheets.
  const [newsItem, setNewsItem] = useState<NewsItem | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [dealReq, setDealReq] = useState<DealRequest | null>(null);
  const [pipelinePreset, setPipelinePreset] = useState<PipelinePreset | null>(null);

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

  const switchTab = useCallback((next: MobileTab) => {
    if (tabRef.current === next) return;
    tabRef.current = next;
    // replace, not push: back should leave the app, not walk tab history.
    try {
      window.history.replaceState(window.history.state, "", next === "route" ? "/m" : `/m/${next}`);
    } catch {
      /* noop */
    }
    const apply = () => flushSync(() => setTab(next));
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === "function") {
      try {
        doc.startViewTransition(apply);
      } catch {
        apply();
      }
    } else {
      apply();
    }
  }, []);

  const goPipeline = useCallback(
    (jump: PipelineJump) => {
      setPipelinePreset({ key: Date.now(), ...jump });
      switchTab("pipeline");
    },
    [switchTab],
  );

  const openDeal = useCallback((deal: LiteDeal) => {
    setDealReq({ id: deal.id, seed: deal });
  }, []);

  const openDealById = useCallback((id: string) => {
    setDealReq({ id, seed: null });
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

  const refreshAll = useCallback(async () => {
    await Promise.all([news.reload(), crm.reload(), events.reload()]);
  }, [news.reload, crm.reload, events.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  // Latched copies keep sheet content visible during the exit slide.
  const shownNews = useLatched(newsItem);
  const shownPerson = useLatched(person);

  return (
    <div className={`${s.shell}${standalone ? ` ${s.standalone}` : ""}`}>
      <div className={s.scrim} />
      {!online ? <div className={s.offline}>Offline — showing cached data</div> : null}

      <RouteTab
        active={tab === "route"}
        news={news.state}
        crm={crm.state}
        events={events.state}
        retryNews={() => void news.reload()}
        retryCrm={() => void crm.reload()}
        onRefresh={refreshAll}
        openNews={setNewsItem}
        openDeal={openDeal}
        goPipeline={goPipeline}
      />
      <PipelineTab
        active={tab === "pipeline"}
        crm={crm.state}
        retry={() => void crm.reload()}
        openDeal={openDeal}
        preset={pipelinePreset}
      />
      <NetworkTab
        active={tab === "network"}
        network={network.state}
        retry={() => void network.reload()}
        openPerson={setPerson}
      />
      <DeskTab active={tab === "desk"} user={user} />

      <nav className={s.tabbar} aria-label="Tabs">
        {TAB_META.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`${s.tabBtn} ${s.press}${tab === id ? ` ${s.tabBtnActive}` : ""}`}
            onClick={() => switchTab(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon />
            <span className={s.tabLabel}>{label}</span>
            <span className={s.tabDot} />
          </button>
        ))}
      </nav>

      {/* ── News story sheet ─────────────────────────────────── */}
      <Sheet open={!!newsItem} onClose={() => setNewsItem(null)} title="On the Wire">
        {shownNews ? (
          <div>
            <div className={s.sheetH1}>{shownNews.title}</div>
            <div className={s.sheetChips}>
              {shownNews.source ? <span className={s.srcChip}>{shownNews.source}</span> : null}
              {shownNews.category ? <span className={s.catChip}>{shownNews.category}</span> : null}
            </div>
            {shownNews.summary ? <p className={s.sheetPara}>{shownNews.summary}</p> : null}
            {shownNews.whyItMatters ? (
              <>
                <div className={s.whyLabel}>Why it matters</div>
                <p className={s.sheetPara} style={{ marginTop: 4 }}>
                  {shownNews.whyItMatters}
                </p>
              </>
            ) : null}
            {shownNews.url ? (
              <div className={s.actRow} style={{ marginTop: 20 }}>
                <a
                  className={`${s.actBtn} ${s.actBtnAccent} ${s.press}`}
                  href={shownNews.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read at {shownNews.source || "source"} <ExternalIcon />
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      {/* ── Person sheet ─────────────────────────────────────── */}
      <Sheet open={!!person} onClose={() => setPerson(null)} title="Network">
        {shownPerson ? (
          <div>
            <div className={s.sheetH1}>{shownPerson.name}</div>
            <div className={s.sheetMeta}>
              {[
                shownPerson.company,
                [shownPerson.city, shownPerson.state].filter(Boolean).join(", "),
                shownPerson.kind === "investor" ? shownPerson.investorType : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
            <div className={s.sheetChips}>
              <span className={`${s.kindChip} ${shownPerson.kind === "founder" ? s.kindFounder : s.kindInvestor}`}>
                {shownPerson.kind === "founder" ? "Founder" : "Investor"}
              </span>
            </div>
            <div className={s.actRow} style={{ marginTop: 18 }}>
              {shownPerson.email ? (
                <a className={`${s.actBtn} ${s.press}`} href={`mailto:${shownPerson.email}`}>
                  <MailIcon /> Email
                </a>
              ) : null}
              {shownPerson.website ? (
                <a
                  className={`${s.actBtn} ${s.press}`}
                  href={
                    shownPerson.website.startsWith("http")
                      ? shownPerson.website
                      : `https://${shownPerson.website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Website <ExternalIcon />
                </a>
              ) : null}
              {shownPerson.linkedin ? (
                <a
                  className={`${s.actBtn} ${s.press}`}
                  href={
                    shownPerson.linkedin.startsWith("http")
                      ? shownPerson.linkedin
                      : `https://${shownPerson.linkedin}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn <ExternalIcon />
                </a>
              ) : null}
            </div>
            {!shownPerson.email && !shownPerson.website && !shownPerson.linkedin ? (
              <p className={s.sheetMeta} style={{ marginTop: 14 }}>
                No contact details on file.
              </p>
            ) : null}
            {shownPerson.dealId ? (
              <div className={s.actRow} style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className={`${s.actBtn} ${s.actBtnPrimary} ${s.press}`}
                  onClick={() => openDealById(shownPerson.dealId as string)}
                >
                  View deal →
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      {/* ── Deal sheet (stacks above the person sheet) ───────── */}
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
