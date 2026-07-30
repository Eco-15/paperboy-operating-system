"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PanelSkeleton from "./PanelSkeleton";

type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  whyItMatters: string | null;
};

// Right-rail feed of AI-curated CPG/consumer + investing stories. Backed by
// /api/dashboard/news (populated by the Exa.ai → Claude news loop). Until that
// loop has run it degrades to a friendly empty state.
export default function NewsPanel() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/news")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => active && setItems(d.news ?? []))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="dash-panel dash-news">
      <div className="dash-panel-head">
        <span className="dash-panel-title">Industry News</span>
        <Link href="/news" className="dash-panel-link">
          Read the paper →
        </Link>
      </div>

      {items === null && !failed && <PanelSkeleton />}

      {(failed || (items && items.length === 0)) && (
        <div className="dash-empty">No stories yet — today&apos;s edition hasn&apos;t run.</div>
      )}

      {items && items.length > 0 && (
        <div className="dash-news-list">
          {items.map((n) => (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="dash-news-item"
            >
              <div className="dash-news-title">{n.title}</div>
              {n.source && <div className="dash-news-source">{n.source}</div>}
              {(n.whyItMatters ?? n.summary) && (
                <div className="dash-news-why">{n.whyItMatters ?? n.summary}</div>
              )}
            </a>
          ))}
        </div>
      )}
    </aside>
  );
}
