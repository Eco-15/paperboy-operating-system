"use client";

// The rolodex: sticky search + kind chips over an A–Z grouped list with
// sticky letter headers. Renders at most 200 rows (simple windowing) so
// 1,200+ people stay smooth on a phone.
import { useMemo, useState } from "react";
import { errorLabel, type NetworkPayload, type Person, type Remote } from "./data";
import s from "./mobile.module.css";

type Kind = "all" | "founder" | "investor";

const VISIBLE_CAP = 200;

export default function NetworkTab({
  active,
  network,
  retry,
  openPerson,
}: {
  active: boolean;
  network: Remote<NetworkPayload>;
  retry: () => void;
  openPerson: (p: Person) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  const people = network.data?.people ?? null;

  const filtered = useMemo(() => {
    if (!people) return null;
    const q = query.trim().toLowerCase();
    let list = people;
    if (kind !== "all") list = list.filter((p) => p.kind === kind);
    if (q) {
      list = list.filter((p) =>
        `${p.name} ${p.company ?? ""} ${p.city ?? ""} ${p.state ?? ""}`.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [people, query, kind]);

  const groups = useMemo(() => {
    if (!filtered) return null;
    const shown = filtered.slice(0, VISIBLE_CAP);
    const map = new Map<string, Person[]>();
    for (const p of shown) {
      const first = (p.name[0] ?? "#").toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      const bucket = map.get(letter);
      if (bucket) bucket.push(p);
      else map.set(letter, [p]);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <section className={`${s.pane}${active ? ` ${s.paneActive}` : ""}`} aria-hidden={!active}>
      <div className={s.netHead}>
        <input
          className={s.search}
          type="search"
          placeholder={people ? `Search ${people.length.toLocaleString()} people…` : "Search people…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <div className={s.chipsRow}>
          {(
            [
              ["all", "All"],
              ["founder", "Founders"],
              ["investor", "Investors"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${s.chip}${kind === value ? ` ${s.chipActive}` : ""}`}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {groups ? (
        groups.length === 0 ? (
          <div className={s.emptyBox}>
            {query ? `Nobody matches “${query.trim()}”.` : "No people in the network yet."}
          </div>
        ) : (
          <>
            {groups.map(([letter, members]) => (
              <div key={letter}>
                <div className={s.letterHead}>{letter}</div>
                <div className={s.list} style={{ paddingTop: 2 }}>
                  {members.map((p) => (
                    <button key={p.id} type="button" className={`${s.personRow} ${s.press}`} onClick={() => openPerson(p)}>
                      <span className={s.personMain}>
                        <span className={s.personName}>{p.name}</span>
                        <span className={s.personMeta}>
                          {[p.company, [p.city, p.state].filter(Boolean).join(", ")]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </span>
                      <span className={`${s.kindChip} ${p.kind === "founder" ? s.kindFounder : s.kindInvestor}`}>
                        {p.kind === "founder" ? "Founder" : "Investor"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filtered && filtered.length > VISIBLE_CAP ? (
              <div className={s.capNote}>
                Showing {VISIBLE_CAP} of {filtered.length.toLocaleString()} — refine the search.
              </div>
            ) : null}
          </>
        )
      ) : network.status === "error" ? (
        <div className={s.errBox}>
          {errorLabel(network.code)}
          <br />
          <button type="button" className={`${s.retryBtn} ${s.press}`} onClick={retry}>
            Retry
          </button>
        </div>
      ) : (
        <div className={s.list}>
          <div className={s.skel} style={{ height: 60 }} />
          <div className={s.skel} style={{ height: 60 }} />
          <div className={s.skel} style={{ height: 60 }} />
          <div className={s.skel} style={{ height: 60 }} />
          <div className={s.skel} style={{ height: 60 }} />
        </div>
      )}
    </section>
  );
}
