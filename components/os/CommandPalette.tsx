"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tiles } from "@/lib/tiles";

type Item = { id: string; label: string; sub?: string; group: string; href: string };

// Static navigation targets — always available, no fetch needed.
const NAV: Item[] = [
  { id: "nav-home", label: "Home", sub: "Dashboard", group: "Go to", href: "/dashboard" },
  ...tiles
    .filter((t) => !t.href.startsWith("/coming-soon"))
    .map((t) => ({ id: `nav-${t.index}`, label: t.title, sub: t.stat, group: "Go to", href: t.href })),
];

// ⌘K command palette: jump to any module and search investors + deals. Records
// are lazy-loaded on first open from the existing APIs and filtered client-side.
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [records, setRecords] = useState<Item[]>([]);
  const loaded = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load searchable records once, on first open. Failures (e.g. a client
  // role that can't read deals) degrade to fewer results, never an error.
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    (async () => {
      const out: Item[] = [];
      try {
        const r = await fetch("/api/investors");
        if (r.ok) {
          const d = await r.json();
          for (const inv of d.investors ?? []) {
            const name: string = inv["Group Name"];
            if (!name) continue;
            out.push({
              id: `inv-${name}`,
              label: name,
              sub: [inv.Type, inv.City, inv.State].filter(Boolean).join(" · "),
              group: "Investors",
              href: `/investors?q=${encodeURIComponent(name)}`,
            });
          }
        }
      } catch {
        /* ignore */
      }
      try {
        const r = await fetch("/api/crm");
        if (r.ok) {
          const d = await r.json();
          for (const deal of d.deals ?? []) {
            if (!deal?.id || !deal?.name) continue;
            out.push({
              id: `deal-${deal.id}`,
              label: deal.name,
              sub: [deal.stage, deal.origin].filter(Boolean).join(" · "),
              group: "Deals",
              href: `/crm/${deal.id}`,
            });
          }
        }
      } catch {
        /* ignore */
      }
      setRecords(out);
    })();
  }, [open]);

  // Reset + focus each time it opens.
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return NAV.slice(0, 12);
    const nav = NAV.filter((i) => i.label.toLowerCase().includes(query));
    const recs = records.filter((i) => i.label.toLowerCase().includes(query)).slice(0, 24);
    return [...nav, ...recs];
  }, [q, records]);

  useEffect(() => {
    if (active > results.length - 1) setActive(0);
  }, [results, active]);

  const go = useCallback(
    (item?: Item) => {
      const target = item ?? results[active];
      if (!target) return;
      onClose();
      router.push(target.href);
    },
    [results, active, onClose, router],
  );

  if (!open) return null;

  // Group for display while tracking a flat index for keyboard highlighting.
  const groups: Record<string, Item[]> = {};
  for (const r of results) (groups[r.group] ??= []).push(r);
  let flat = -1;

  return (
    <div className="cmdk-overlay" onMouseDown={onClose}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          className="cmdk-input"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          placeholder="Search modules, investors, deals…"
          aria-label="Search Paperboy OS"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <div className="cmdk-results">
          {results.length === 0 && <div className="cmdk-empty">No matches</div>}
          {Object.entries(groups).map(([group, items]) => (
            <div className="cmdk-group" key={group}>
              <div className="cmdk-group-label">{group}</div>
              {items.map((item) => {
                flat++;
                const i = flat;
                return (
                  <button
                    key={item.id}
                    className={"cmdk-item" + (i === active ? " cmdk-item--active" : "")}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                  >
                    <span className="cmdk-item-label">{item.label}</span>
                    {item.sub && <span className="cmdk-item-sub">{item.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <kbd>↑↓</kbd> navigate · <kbd>↵</kbd> open · <kbd>esc</kbd> close
        </div>
      </div>
    </div>
  );
}
