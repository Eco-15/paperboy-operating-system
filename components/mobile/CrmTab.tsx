"use client";

// The Investment CRM on a phone — and, since 2026-07, the entire mobile app.
// Masthead + account, the "new since you last looked" tray, scope segmented
// control, search, stage chips with live counts, full column sorting (shared
// with the desktop via lib/crm/sort), and tap-to-edit deal rows.
import { useMemo, useRef, useState } from "react";
import { relativeTime } from "@/lib/crm/format";
import { sortDeals, type SortState } from "@/lib/crm/sort";
import { STAGE_ORDER, stageColor, stageKey } from "@/lib/crm/stages";
import { errorLabel, type CrmPayload, type LiteDeal, type Remote } from "./data";
import { PeopleIcon, SortIcon } from "./icons";
import s from "./mobile.module.css";
import { usePullToRefresh } from "./usePullToRefresh";

export type Scope = "active" | "all" | "parked";

const VISIBLE_CAP = 250;
const TRAY_PREVIEW = 5;

export default function CrmTab({
  crm,
  retry,
  openDeal,
  onRefresh,
  openAccount,
  openSort,
  sort,
  newIds,
  newSince,
  onAcknowledgeNew,
}: {
  crm: Remote<CrmPayload>;
  retry: () => void;
  openDeal: (deal: LiteDeal) => void;
  onRefresh: () => Promise<void>;
  openAccount: () => void;
  openSort: () => void;
  sort: SortState;
  newIds: string[];
  newSince: string | null;
  onAcknowledgeNew: () => void;
}) {
  const [scope, setScope] = useState<Scope>("active");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [unratedOnly, setUnratedOnly] = useState(false);
  const [trayOpen, setTrayOpen] = useState(true);

  const paneRef = useRef<HTMLElement>(null);
  const pullRef = useRef<HTMLDivElement>(null);
  usePullToRefresh(paneRef, pullRef, onRefresh);

  const all = crm.data?.deals ?? null;
  const newSet = useMemo(() => new Set(newIds), [newIds]);

  const scoped = useMemo(() => {
    if (!all) return null;
    if (scope === "all") return all;
    return all.filter((d) => d.archived === (scope === "parked"));
  }, [all, scope]);

  // Present stages with counts, in board order (archive statuses trail).
  const stages = useMemo(() => {
    if (!scoped) return [];
    const counts = new Map<string, number>();
    for (const d of scoped) {
      const k = stageKey(d);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const order = (v: string) => {
      const i = STAGE_ORDER.indexOf(v);
      return i < 0 ? 99 : i;
    };
    return [...counts.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]));
  }, [scoped]);

  const shown = useMemo(() => {
    if (!scoped) return null;
    const q = query.trim().toLowerCase();
    let list = scoped;
    if (q) {
      list = list.filter((d) =>
        `${d.company} ${d.category ?? ""} ${d.subcategory ?? ""} ${d.contactName ?? ""} ${d.source ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (stage) list = list.filter((d) => stageKey(d) === stage);
    if (unratedOnly) list = list.filter((d) => d.priority == null);
    // No explicit sort = the API's newest-first order, which is the right
    // default on a phone.
    return sortDeals(list, sort);
  }, [scoped, query, stage, unratedOnly, sort]);

  const visible = shown ? shown.slice(0, VISIBLE_CAP) : null;

  // The tray reads from the whole book — a lead that's parked, or filtered out
  // of the list below, is still something you haven't seen.
  const tray = useMemo(() => {
    if (!all || newIds.length === 0) return [];
    const byId = new Map(all.map((d) => [d.id, d]));
    return newIds.map((id) => byId.get(id)).filter((d): d is LiteDeal => !!d);
  }, [all, newIds]);
  const trayShown = trayOpen ? tray.slice(0, TRAY_PREVIEW) : [];

  return (
    <section className={`${s.pane} ${s.paneActive}`} ref={paneRef}>
      <div className={s.pullWrap} ref={pullRef}>
        <div className={s.pullSpinner} aria-hidden="true">
          ↻
        </div>

        <div className={s.crmHead}>
          <div className={s.headRow}>
            <div className={s.headTitles}>
              <div className={s.headBrand}>Paperboy</div>
              <div className={s.headSub}>Investment CRM</div>
            </div>
            <button
              type="button"
              className={`${s.acctBtn} ${s.press}`}
              onClick={openAccount}
              aria-label="Account"
            >
              <PeopleIcon />
            </button>
          </div>

          <div className={s.segRow}>
            <div className={s.seg} role="tablist" aria-label="Scope">
              {(
                [
                  ["active", "Active"],
                  ["all", "All"],
                  ["parked", "Parked"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`${s.segBtn}${scope === value ? ` ${s.segBtnActive}` : ""}`}
                  onClick={() => setScope(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`${s.sortBtn}${sort ? ` ${s.sortBtnActive}` : ""} ${s.press}`}
              onClick={openSort}
              aria-label="Sort deals"
            >
              <SortIcon /> {sort ? sortLabel(sort) : "Newest"}
            </button>
          </div>

          <input
            className={s.search}
            type="search"
            placeholder="Search deals…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />

          <div className={s.chipsRow}>
            {unratedOnly ? (
              <button type="button" className={`${s.chip} ${s.chipDashed}`} onClick={() => setUnratedOnly(false)}>
                Unrated only ✕
              </button>
            ) : null}
            <button
              type="button"
              className={`${s.chip}${stage === null && !unratedOnly ? ` ${s.chipActive}` : ""}`}
              onClick={() => {
                setStage(null);
                setUnratedOnly(false);
              }}
            >
              All{scoped ? <span className={s.chipCount}>{scoped.length}</span> : null}
            </button>
            {stages.map(([st, count]) => (
              <button
                key={st}
                type="button"
                className={`${s.chip}${stage === st ? ` ${s.chipActive}` : ""}`}
                onClick={() => setStage((cur) => (cur === st ? null : st))}
              >
                <span className={s.chipDot} style={{ background: stageColor(st) }} />
                {st}
                <span className={s.chipCount}>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── New since you last looked ─────────────────────────────── */}
        {tray.length > 0 ? (
          <div className={s.tray}>
            <button
              type="button"
              className={s.trayHead}
              onClick={() => setTrayOpen((v) => !v)}
              aria-expanded={trayOpen}
            >
              <span className={s.trayCount}>{tray.length}</span>
              <span className={s.trayTitle}>
                new {tray.length === 1 ? "response" : "responses"}
                {newSince ? <span className={s.traySince}> since {relativeTime(newSince)}</span> : null}
              </span>
              <span className={s.trayChevron} aria-hidden="true">
                {trayOpen ? "▾" : "▸"}
              </span>
            </button>

            {trayOpen ? (
              <>
                {trayShown.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`${s.trayRow} ${s.press}`}
                    onClick={() => openDeal(d)}
                  >
                    <span className={s.trayCo}>{d.company}</span>
                    <span className={s.trayMeta}>
                      {d.contactName || d.contactEmail || d.source || "Inbound"}
                    </span>
                    <span className={s.trayWhen}>{relativeTime(d.arrivedAt ?? d.date)}</span>
                  </button>
                ))}
                {tray.length > trayShown.length ? (
                  <div className={s.trayMore}>+{tray.length - trayShown.length} more in the list below</div>
                ) : null}
                <button type="button" className={s.trayAck} onClick={onAcknowledgeNew}>
                  Mark all caught up
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {visible ? (
          visible.length === 0 ? (
            <div className={s.emptyBox}>
              {query || stage || unratedOnly ? "Nothing matches — clear the filters or search." : "No deals here yet."}
            </div>
          ) : (
            <>
              <div className={s.list}>
                {visible.map((d) => (
                  <button key={d.id} type="button" className={`${s.dealRow} ${s.press}`} onClick={() => openDeal(d)}>
                    <span className={s.dealMain}>
                      <span className={s.dealCo}>
                        <span className={s.dealCoName}>{d.company}</span>
                        {newSet.has(d.id) ? <span className="crm-badge-new">NEW</span> : null}
                      </span>
                      <span className={s.dealMeta}>
                        {[d.category, d.subcategory].filter(Boolean).join(" · ") || d.source || "—"}
                      </span>
                    </span>
                    <span className={s.dealSide}>
                      <span className="crm-stage-tag" style={{ background: stageColor(stageKey(d)) }}>
                        {stageKey(d)}
                      </span>
                      {d.priority != null ? (
                        <span className={`crm-pri${d.priority >= 5 ? " crm-pri--high" : ""}`}>P{d.priority}</span>
                      ) : (
                        <span className="crm-pri crm-pri--unrated">unrated</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
              {shown && shown.length > VISIBLE_CAP ? (
                <div className={s.capNote}>
                  Showing {VISIBLE_CAP} of {shown.length} — refine the search.
                </div>
              ) : null}
            </>
          )
        ) : crm.status === "error" ? (
          <div className={s.errBox}>
            {errorLabel(crm.code)}
            <br />
            <button type="button" className={`${s.retryBtn} ${s.press}`} onClick={retry}>
              Retry
            </button>
          </div>
        ) : (
          <div className={s.list}>
            <div className={s.skel} style={{ height: 64 }} />
            <div className={s.skel} style={{ height: 64 }} />
            <div className={s.skel} style={{ height: 64 }} />
            <div className={s.skel} style={{ height: 64 }} />
          </div>
        )}
      </div>
    </section>
  );
}

function sortLabel(sort: NonNullable<SortState>): string {
  const label = sort.col === "priority" ? "Pri" : sort.col[0].toUpperCase() + sort.col.slice(1);
  return `${label} ${sort.dir === "asc" ? "↑" : "↓"}`;
}
