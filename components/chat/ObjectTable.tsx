"use client";

import Link from "next/link";
import { objectHref, objectTitle, previewColumns } from "@/lib/chat/entities";

function cell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return Array.isArray(v) ? `${v.length} item(s)` : "{…}";
  const s = String(v);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

// Ontology results rendered as a real table whose rows link back into the OS.
export default function ObjectTable({
  objectType,
  objects,
  compact = false,
}: {
  objectType: string;
  objects: Record<string, unknown>[];
  compact?: boolean;
}) {
  if (!objects.length) return <div className="chat-empty-note">No results.</div>;
  const cols = previewColumns(objectType, objects);

  return (
    <div className="chat-objtable-wrap">
      <table className={`chat-objtable${compact ? " is-compact" : ""}`}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th aria-label="open" />
          </tr>
        </thead>
        <tbody>
          {objects.map((o, i) => {
            const link = objectHref(objectType, o);
            return (
              <tr key={String(o.id ?? i)}>
                {cols.map((c) => (
                  <td key={c}>{cell(o[c])}</td>
                ))}
                <td className="chat-objtable-open">
                  {link ? (
                    link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" title={objectTitle(objectType, o)}>
                        ↗
                      </a>
                    ) : (
                      <Link href={link.href} title={objectTitle(objectType, o)}>
                        ↗
                      </Link>
                    )
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
