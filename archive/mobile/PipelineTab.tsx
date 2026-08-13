"use client";

// The deal book on a phone: scope segmented control, big search, stage chips
// with live counts, sort toggle, and tap-to-edit deal rows. Consumes jump
// presets from the Route tab's desk rows (e.g. "unrated deals").
import { useEffect, useMemo, useState } from "react";
import { STAGE_ORDER, stageColor, stageKey } from "@/lib/crm/stages";
import { errorLabel, ts, type CrmPayload, type LiteDeal, type Remote } from "./data";
import { SortIcon } from "./icons";
import s from "./mobile.module.css";

export type Scope = "active" | "all" | "parked";
export type Sort = "newest" | "priority";

export type PipelinePreset = {
  key: number; // bump to re-apply
  scope: Scope;
  sort: Sort;
  unrated: boolean;
};

const VISIBLE_CAP = 250;

export default function PipelineTab({
  active,
  crm,
  retry,
  openDeal,
  preset,
}: {
  active: boolean;
  crm: Remote<CrmPayload>;
  retry: () => void;
  openDeal: (deal: LiteDeal) => void;
  preset: PipelinePreset | null;
}) {
  const [scope, setScope] = useState<Scope>("active");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("newest");
  const [unratedOnly, setUnratedOnly] = useState(false);

  // Desk-row jumps replace the current filters wholesale.
  const presetKey = preset?.key ?? 0;
  useEffect(() => {
    if (!preset) return;
    setScope(preset.scope);
    setSort(preset.sort);
    setUnratedOnly(preset.unrated);
    setStage(null);
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey]);

  const all = crm.data?.deals ?? null;

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
    const sorted = [...list];
    if (sort === "priority") {
      sorted.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || ts(b.date) - ts(a.date));
    } else {
      sorted.sort((a, b) => ts(b.date) - ts(a.date));
    }
    return sorted;
  }, [scoped, query, stage, unratedOnly, sort]);

  const visible = shown ? shown.slice(0, VISIBLE_CAP) : null;

  return (
    <section className={`${s.pane}${active ? ` ${s.paneActive}` : ""}`} aria-hidden={!active}>
      <div className={s.pipeHead}>
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
            className={`${s.sortBtn} ${s.press}`}
            onClick={() => setSort((v) => (v === "newest" ? "priority" : "newest"))}
            aria-label="Toggle sort"
          >
            <SortIcon /> {sort === "newest" ? "Newest" : "Priority"}
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
                    <span className={s.dealCo}>{d.company}</span>
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
    </section>
  );
}
