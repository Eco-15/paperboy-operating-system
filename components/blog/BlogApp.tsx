"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlogPost } from "@/lib/blog/types";

// The Front Page feed. Staff click a post to open the editor (/blog/[id]);
// writing/publishing lives there — this is just the list + "New Post".
// Beehiiv newsletter posts are merged into the feed read-only.

function statusLabel(p: BlogPost): { text: string; cls: string } | null {
  if (p.source === "beehiiv") return { text: "Newsletter", cls: "blog-badge--news" };
  if (p.status === "draft") return { text: "Draft", cls: "blog-badge--draft" };
  if (p.hasUnpublishedChanges)
    return { text: "Unpublished changes", cls: "blog-badge--dirty" };
  return { text: "Published", cls: "blog-badge--live" };
}

export default function BlogApp({ canCompose = false }: { canCompose?: boolean }) {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/blog")
      .then((r) => r.json())
      .then((j) => {
        if (active) setPosts(j.posts ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function newPost() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled post", category: "News" }),
      });
      if (res.ok) {
        const { post } = (await res.json()) as { post: BlogPost };
        router.push(`/blog/${post.id}`);
        return;
      }
    } catch {
      /* fall through */
    }
    setCreating(false);
  }

  return (
    <>
      <div className="tool-toolbar">
        <span className="tool-count">
          {loaded ? `${posts.length} posts` : "Loading…"}
        </span>
        {canCompose && (
          <button
            className="tool-btn tool-btn--solid"
            type="button"
            onClick={newPost}
            disabled={creating}
            style={{ marginLeft: "auto" }}
          >
            {creating ? "Creating…" : "+ New Post"}
          </button>
        )}
      </div>

      <div className="blog-feed">
        {posts.map((p) => {
          const badge = statusLabel(p);
          const editable = canCompose && p.source === "db";
          return (
            <article
              className={`blog-card${editable ? " blog-card--editable" : ""}`}
              key={p.id}
              onClick={editable ? () => router.push(`/blog/${p.id}`) : undefined}
            >
              <div className="blog-cover">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="blog-cover-img" />
                ) : (
                  <span className="blog-cover-mark">paperboy</span>
                )}
              </div>
              <div className="blog-card-body">
                <div className="blog-card-meta">
                  <span className="blog-cat">{p.category}</span>
                  {badge && <span className={`blog-badge ${badge.cls}`}>{badge.text}</span>}
                </div>
                <h3 className="blog-title">{p.title}</h3>
                {(p.excerpt || p.body) && (
                  <p className="blog-excerpt">{p.excerpt || p.body}</p>
                )}
                <div className="blog-date">{p.date}</div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
