"use client";

// Full deal view + one-tap editors. Seeded instantly from the lite row when
// opened from a list, then hydrated from GET /api/crm/[id] (message + memo).
// Edits are optimistic: local + shared list state update immediately, PATCH
// runs behind, failure rolls back with a toast.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Deal } from "@/lib/crm/types";
import {
  ARCHIVE_STATUSES,
  ASSIGNABLE_STAGES,
  FUNDS,
  stageColor,
  stageKey,
} from "@/lib/crm/stages";
import Sheet from "./Sheet";
import { useLatched, type LiteDeal } from "./data";
import { ExternalIcon, MailIcon } from "./icons";
import s from "./mobile.module.css";

export type DealRequest = { id: string; seed: LiteDeal | null };

const MEMO_PREVIEW = 600;

type PatchFields = Partial<Pick<Deal, "stage" | "priority" | "fund" | "archived">>;

export default function DealSheet({
  req,
  onClose,
  onPatched,
  showToast,
}: {
  req: DealRequest | null;
  onClose: () => void;
  onPatched: (deal: LiteDeal) => void;
  showToast: (msg: string) => void;
}) {
  const latched = useLatched(req);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ok">("loading");
  const idRef = useRef<string | null>(null);
  const reqId = req?.id ?? null;
  const reqSeed = req?.seed ?? null;

  const load = useCallback(async (id: string) => {
    setLoadState("loading");
    try {
      const res = await fetch(`/api/crm/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { deal: Deal };
      if (idRef.current === id) {
        setDeal(json.deal);
        setLoadState("ok");
      }
    } catch {
      if (idRef.current === id) setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!reqId) return;
    idRef.current = reqId;
    // Paint instantly from the lite row while the full record loads.
    setDeal(reqSeed ? { ...reqSeed, message: null, onePager: null } : null);
    void load(reqId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqId, load]);

  const dealRef = useRef<Deal | null>(null);
  dealRef.current = deal;

  const patch = useCallback(
    async (fields: PatchFields) => {
      const prev = dealRef.current;
      if (!prev) return;
      const next = { ...prev, ...fields };
      setDeal(next);
      onPatched(next);
      try {
        const res = await fetch(`/api/crm/${prev.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: prev.origin, ...fields }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json().catch(() => null)) as { deal?: Deal } | null;
        const saved = json?.deal ? { ...next, ...json.deal } : next;
        if (idRef.current === prev.id) setDeal(saved);
        onPatched(saved);
        showToast("Saved");
        if (typeof navigator !== "undefined") navigator.vibrate?.(10);
      } catch {
        if (idRef.current === prev.id) setDeal(prev);
        onPatched(prev);
        showToast("Couldn't save — try again");
      }
    },
    [onPatched, showToast],
  );

  const shown = latched;
  const d = deal;

  return (
    <Sheet open={!!req} onClose={onClose} title="Deal">
      {!shown ? null : !d ? (
        loadState === "error" ? (
          <div className={s.errBox}>
            Couldn&apos;t load this deal.
            <br />
            <button type="button" className={`${s.retryBtn} ${s.press}`} onClick={() => shown && load(shown.id)}>
              Retry
            </button>
          </div>
        ) : (
          <div>
            <div className={s.skel} style={{ height: 24, width: "70%" }} />
            <div className={s.skel} style={{ height: 14, width: "45%", marginTop: 10 }} />
            <div className={s.skel} style={{ height: 90, marginTop: 18 }} />
          </div>
        )
      ) : (
        <div>
          <div className={s.sheetH1}>{d.company}</div>
          <div className={s.sheetMeta}>
            {[d.category, d.subcategory, d.source].filter(Boolean).join(" · ") || "No category yet"}
          </div>
          <div className={s.sheetChips}>
            <span className="crm-stage-tag" style={{ background: stageColor(stageKey(d)) }}>
              {stageKey(d)}
            </span>
            {d.priority != null ? (
              <span className={`crm-pri${d.priority >= 5 ? " crm-pri--high" : ""}`}>P{d.priority}</span>
            ) : (
              <span className="crm-pri crm-pri--unrated">unrated</span>
            )}
            {d.fund ? <span className="crm-fund-chip">{d.fund}</span> : null}
            {d.archived ? <span className={s.tbaChip}>parked</span> : null}
          </div>

          {(d.contactName || d.contactEmail || d.website || d.deckLink) && (
            <>
              <div className={s.fieldLabel}>Contact</div>
              {d.contactName ? <div className={s.sheetPara} style={{ marginTop: 4 }}>{d.contactName}</div> : null}
              <div className={s.actRow} style={{ marginTop: 10 }}>
                {d.contactEmail ? (
                  <a className={`${s.actBtn} ${s.press}`} href={`mailto:${d.contactEmail}`}>
                    <MailIcon /> Email
                  </a>
                ) : null}
                {d.website ? (
                  <a
                    className={`${s.actBtn} ${s.press}`}
                    href={d.website.startsWith("http") ? d.website : `https://${d.website}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website <ExternalIcon />
                  </a>
                ) : null}
                {d.deckLink ? (
                  <a className={`${s.actBtn} ${s.press}`} href={d.deckLink} target="_blank" rel="noreferrer">
                    Deck <ExternalIcon />
                  </a>
                ) : null}
              </div>
            </>
          )}

          {d.message ? (
            <>
              <div className={s.fieldLabel}>Note</div>
              <div className={s.sheetPara} style={{ marginTop: 2, fontSize: 13.5, color: "var(--muted)" }}>
                {d.message.length > 400 ? `${d.message.slice(0, 400)}…` : d.message}
              </div>
            </>
          ) : null}

          {d.onePager ? (
            <>
              <div className={s.fieldLabel}>Memo (preview)</div>
              <div className={s.memoBox}>{d.onePager.slice(0, MEMO_PREVIEW)}</div>
            </>
          ) : null}

          <div className={s.fieldLabel}>Stage</div>
          <div className={s.selectWrap}>
            <select
              className={s.select}
              value={d.stage ?? ""}
              onChange={(e) => void patch({ stage: e.target.value })}
            >
              {!d.stage ? (
                <option value="" disabled>
                  Set stage…
                </option>
              ) : null}
              <optgroup label="Pipeline">
                {ASSIGNABLE_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Parked">
                {ARCHIVE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className={s.fieldLabel}>Priority</div>
          <div className={s.priRow}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                className={`${s.priBtn} ${s.press}${d.priority === n ? ` ${s.priBtnOn}` : ""}`}
                onClick={() => void patch({ priority: n })}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className={`${s.priBtn} ${s.press}${d.priority == null ? ` ${s.priBtnOn}` : ""}`}
              onClick={() => void patch({ priority: null })}
            >
              —
            </button>
          </div>

          <div className={s.fieldLabel}>Fund</div>
          <div className={s.selectWrap}>
            <select
              className={s.select}
              value={d.fund ?? ""}
              onChange={(e) => void patch({ fund: e.target.value === "" ? null : e.target.value })}
            >
              <option value="">No fund</option>
              {FUNDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={`${s.archiveBtn} ${s.press}${d.archived ? ` ${s.restoreBtn}` : ""}`}
            onClick={() => void patch({ archived: !d.archived })}
          >
            {d.archived ? "Restore to pipeline" : "Archive deal"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
