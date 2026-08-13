"use client";

// The Morning Route — the home tab. Newspaper masthead, today's wire,
// computed "Your Desk" rows, and a strip of the newest deals. Owns the
// touch-driven pull-to-refresh for its own scroll container.
import { useEffect, useMemo, useRef, useState } from "react";
import { stageColor, stageKey } from "@/lib/crm/stages";
import {
  errorLabel,
  ts,
  type CrmPayload,
  type EventsPayload,
  type LiteDeal,
  type NewsItem,
  type NewsPayload,
  type Remote,
} from "./data";
import { ChevronIcon, RefreshIcon } from "./icons";
import s from "./mobile.module.css";

export type PipelineJump = {
  scope: "active" | "all" | "parked";
  sort: "newest" | "priority";
  unrated: boolean;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function RouteTab({
  active,
  news,
  crm,
  events,
  retryNews,
  retryCrm,
  onRefresh,
  openNews,
  openDeal,
  goPipeline,
}: {
  active: boolean;
  news: Remote<NewsPayload>;
  crm: Remote<CrmPayload>;
  events: Remote<EventsPayload>;
  retryNews: () => void;
  retryCrm: () => void;
  onRefresh: () => Promise<void>;
  openNews: (item: NewsItem) => void;
  openDeal: (deal: LiteDeal) => void;
  goPipeline: (jump: PipelineJump) => void;
}) {
  const paneRef = useRef<HTMLElement | null>(null);
  const pullRef = useRef<HTMLDivElement | null>(null);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Locale-formatted date is computed after mount so SSR and the client
  // can't disagree (timezone/locale).
  const [dateStr, setDateStr] = useState("");
  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    );
  }, []);

  // Pull-to-refresh: translate the content wrapper while the pane sits at
  // scrollTop 0 and the finger drags down; past 70px, refetch. Touch-only by
  // construction (touch events), smooth (no re-renders — direct style writes),
  // and cancelable (drag back up springs it home).
  useEffect(() => {
    const el = paneRef.current;
    const inner = pullRef.current;
    if (!el || !inner) return;

    let startY = 0;
    let pulling = false;
    let dist = 0;

    const settle = (y: number, animate: boolean) => {
      inner.style.transition = animate ? "transform .3s var(--spring)" : "none";
      inner.style.transform = y ? `translateY(${y}px)` : "";
      if (!y) inner.style.setProperty("--pull", "0");
    };

    const onStart = (e: globalThis.TouchEvent) => {
      if (el.scrollTop > 0 || refreshingRef.current) return;
      startY = e.touches[0].clientY;
      pulling = true;
      dist = 0;
    };
    const onMove = (e: globalThis.TouchEvent) => {
      if (!pulling || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || el.scrollTop > 0) {
        if (dist !== 0) settle(0, false);
        dist = 0;
        return;
      }
      e.preventDefault();
      dist = Math.min(110, dy * 0.45);
      inner.style.transition = "none";
      inner.style.transform = `translateY(${dist}px)`;
      inner.style.setProperty("--pull", String(Math.min(1, dist / 70)));
    };
    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      if (refreshingRef.current) return;
      if (dist >= 70) {
        refreshingRef.current = true;
        inner.classList.add(s.pullSpinning);
        settle(52, true);
        void onRefreshRef.current().finally(() => {
          refreshingRef.current = false;
          inner.classList.remove(s.pullSpinning);
          settle(0, true);
        });
      } else {
        settle(0, true);
      }
      dist = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const deals = crm.data?.deals ?? null;
  const desk = useMemo(() => {
    if (!deals) return null;
    const now = Date.now();
    const activeDeals = deals.filter((d) => !d.archived);
    return {
      unrated: activeDeals.filter((d) => d.priority == null).length,
      newThisWeek: activeDeals.filter((d) => {
        const t = ts(d.date);
        return t > 0 && now - t < WEEK_MS;
      }).length,
    };
  }, [deals]);

  const golf = events.data?.events.find((e) => e.slug === "golf-party") ?? null;
  const strip = useMemo(() => (deals ? deals.filter((d) => !d.archived).slice(0, 3) : null), [deals]);
  const edition = news.data?.edition ?? null;

  return (
    <section ref={paneRef} className={`${s.pane}${active ? ` ${s.paneActive}` : ""}`} aria-hidden={!active}>
      <div ref={pullRef} className={s.pullWrap}>
        <div className={s.pullSpinner} aria-hidden>
          <RefreshIcon />
        </div>

        <header className={s.masthead}>
          <div className={s.brand}>Paperboy</div>
          <div className={s.routeLine}>The Morning Route</div>
          <div className={s.dateLine}>
            {dateStr}
            {edition ? ` — Edition ${edition}` : ""}
          </div>
        </header>

        {/* ── On the Wire ────────────────────────────────────── */}
        <div className={s.sectionHead}>
          <span className={s.sectionTitle}>On the Wire</span>
        </div>
        {news.data ? (
          news.data.news.length === 0 ? (
            <div className={s.emptyBox}>No stories in today&apos;s edition yet.</div>
          ) : (
            <div className={s.list}>
              {news.data.news.map((item) => (
                <button key={item.id} type="button" className={`${s.newsCard} ${s.press}`} onClick={() => openNews(item)}>
                  <div className={s.newsTitle}>{item.title}</div>
                  <div className={s.newsMeta}>
                    {item.source ? <span className={s.srcChip}>{item.source}</span> : null}
                    {item.category ? <span className={s.catChip}>{item.category}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : news.status === "error" ? (
          <div className={s.errBox}>
            {errorLabel(news.code)}
            <br />
            <button type="button" className={`${s.retryBtn} ${s.press}`} onClick={retryNews}>
              Retry
            </button>
          </div>
        ) : (
          <div className={s.list}>
            <div className={s.skel} style={{ height: 74 }} />
            <div className={s.skel} style={{ height: 74 }} />
            <div className={s.skel} style={{ height: 74 }} />
          </div>
        )}

        {/* ── Your Desk ──────────────────────────────────────── */}
        <div className={s.sectionHead}>
          <span className={s.sectionTitle}>Your Desk</span>
        </div>
        {desk ? (
          <div className={s.list}>
            {desk.unrated > 0 ? (
              <button
                type="button"
                className={`${s.deskRow} ${s.press}`}
                onClick={() => goPipeline({ scope: "active", sort: "priority", unrated: true })}
              >
                <span className={s.deskDot} />
                <span className={s.deskLabel}>
                  {desk.unrated} deal{desk.unrated === 1 ? "" : "s"} unrated
                </span>
                <span className={s.deskChevron}>
                  <ChevronIcon />
                </span>
              </button>
            ) : null}
            {desk.newThisWeek > 0 ? (
              <button
                type="button"
                className={`${s.deskRow} ${s.press}`}
                onClick={() => goPipeline({ scope: "active", sort: "newest", unrated: false })}
              >
                <span className={s.deskDot} />
                <span className={s.deskLabel}>
                  {desk.newThisWeek} new deal{desk.newThisWeek === 1 ? "" : "s"} this week
                </span>
                <span className={s.deskChevron}>
                  <ChevronIcon />
                </span>
              </button>
            ) : null}
            {golf ? (
              <a className={`${s.deskRow} ${s.press}`} href={`/events/manage/${golf.id}`}>
                <span className={s.deskDot} />
                <span className={s.deskLabel}>
                  {golf.name} — {golf.counts.pending} RSVP{golf.counts.pending === 1 ? "" : "s"} pending ·{" "}
                  {golf.counts.approved} approved
                </span>
                {!golf.date ? <span className={s.tbaChip}>date TBA</span> : null}
                <span className={s.deskChevron}>
                  <ChevronIcon />
                </span>
              </a>
            ) : null}
            {desk.unrated === 0 && desk.newThisWeek === 0 && !golf ? (
              <div className={s.emptyBox}>All caught up — nothing needs you right now.</div>
            ) : null}
          </div>
        ) : crm.status === "error" ? (
          <div className={s.errBox}>
            {errorLabel(crm.code)}
            <br />
            <button type="button" className={`${s.retryBtn} ${s.press}`} onClick={retryCrm}>
              Retry
            </button>
          </div>
        ) : (
          <div className={s.list}>
            <div className={s.skel} style={{ height: 56 }} />
            <div className={s.skel} style={{ height: 56 }} />
          </div>
        )}

        {/* ── The Pipeline strip ─────────────────────────────── */}
        <div className={s.sectionHead}>
          <span className={s.sectionTitle}>The Pipeline</span>
          <button
            type="button"
            className={s.sectionLink}
            onClick={() => goPipeline({ scope: "active", sort: "newest", unrated: false })}
          >
            All →
          </button>
        </div>
        {strip ? (
          strip.length === 0 ? (
            <div className={s.emptyBox}>No deals in the pipeline yet.</div>
          ) : (
            <div className={s.stripRow}>
              {strip.map((d) => (
                <button key={d.id} type="button" className={`${s.miniCard} ${s.press}`} onClick={() => openDeal(d)}>
                  <div className={s.miniCo}>{d.company}</div>
                  <div className={s.miniMeta}>{[d.category, d.subcategory].filter(Boolean).join(" · ") || "—"}</div>
                  <div className={s.miniStage}>
                    <span className={s.chipDot} style={{ background: stageColor(stageKey(d)) }} />
                    {stageKey(d)}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : crm.status !== "error" ? (
          <div className={s.stripRow}>
            <div className={s.skel} style={{ height: 84, width: 182, flex: "none" }} />
            <div className={s.skel} style={{ height: 84, width: 182, flex: "none" }} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
