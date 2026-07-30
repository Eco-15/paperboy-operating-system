"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, BubbleMenu, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import type { BlogDraft, BlogPost } from "@/lib/blog/types";
import { slugify } from "@/lib/blog/schema";

// Substack-style editor: the writing surface IS the article — cream paper,
// newspaper type, formatting via a selection bubble. Markdown stays the
// storage format (Tiptap ⇄ markdown via tiptap-markdown), so the publish
// pipeline and the public PressMarkdown renderer are untouched. Only nodes
// PressMarkdown can render are enabled (h2, bold, italic, quote, lists,
// links, images).

const CATEGORIES = ["DEALS", "Guide", "News", "Brand"];

function todayStr(): string {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/site-editor/assets", { method: "POST", body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return { error: j?.error ?? `Upload failed (${res.status})` };
    }
    const j = (await res.json()) as { url: string };
    return { url: j.url };
  } catch {
    return { error: "Upload failed — network error" };
  }
}

// Auto-growing textarea for the title/subtitle fields.
function GrowingText({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
    />
  );
}

function BubbleButton({
  editor,
  active,
  label,
  title,
  onClick,
}: {
  editor: Editor;
  active?: boolean;
  label: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  void editor;
  return (
    <button
      type="button"
      title={title}
      className={active ? "is-active" : undefined}
      onMouseDown={(e) => {
        // Keep the text selection — don't let the button steal focus.
        e.preventDefault();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

export default function BlogEditorApp({ id }: { id: string }) {
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [draft, setDraft] = useState<BlogDraft | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"publish" | "unpublish" | "delete" | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const draftRef = useRef<BlogDraft | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const bodyFileRef = useRef<HTMLInputElement>(null);

  const flushSave = useCallback(async (): Promise<boolean> => {
    const d = draftRef.current;
    if (!d) return false;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaveState("saving");
    try {
      const res = await fetch(`/api/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { post: BlogPost };
      // Only adopt server post state when something meaningful changed —
      // avoids re-render churn while the user is typing.
      setPost((prev) =>
        prev &&
        prev.status === j.post.status &&
        prev.hasUnpublishedChanges === j.post.hasUnpublishedChanges &&
        prev.publishedAt === j.post.publishedAt &&
        prev.slug === j.post.slug
          ? prev
          : j.post,
      );
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }, [id]);

  const update = useCallback(
    (patch: Partial<BlogDraft>) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        draftRef.current = next;
        return next;
      });
      setActionError(null);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flushSave(), 1200);
    },
    [flushSave],
  );

  const insertUploadedImage = useCallback(
    async (editor: Editor, file: File) => {
      const res = await uploadImage(file);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      editor
        .chain()
        .focus()
        .setImage({ src: res.url, alt: file.name.replace(/\.[a-z0-9]+$/i, "") })
        .run();
    },
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
      }),
      TiptapLink.configure({ openOnClick: false, autolink: true }),
      TiptapImage,
      Placeholder.configure({ placeholder: "Start writing…" }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    editorProps: {
      handleDrop: (view, event) => {
        const file = event.dataTransfer?.files?.[0];
        if (file && file.type.startsWith("image/")) {
          event.preventDefault();
          if (editorRef.current) void insertUploadedImage(editorRef.current, file);
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const file = Array.from(event.clipboardData?.items ?? [])
          .find((i) => i.type.startsWith("image/"))
          ?.getAsFile();
        if (file) {
          event.preventDefault();
          if (editorRef.current) void insertUploadedImage(editorRef.current, file);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      update({ body: editor.storage.markdown.getMarkdown() });
    },
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // Load the post, then seed the editor once.
  useEffect(() => {
    let active = true;
    fetch(`/api/blog/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { post: BlogPost; draft: BlogDraft }) => {
        if (!active) return;
        setPost(j.post);
        const d = { ...j.draft, displayDate: j.draft.displayDate || todayStr() };
        setDraft(d);
        draftRef.current = d;
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (editor && draft && !seeded) {
      editor.commands.setContent(draft.body, false);
      setSeeded(true);
    }
  }, [editor, draft, seeded]);

  // Flush pending edits on unmount.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        void flushSave();
      }
    };
  }, [flushSave]);

  function onTitleChange(title: string) {
    const autoSlug = !slugTouched && !post?.publishedAt;
    update(autoSlug ? { title, slug: slugify(title) } : { title });
  }

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "" || url === "https://") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }

  async function onCoverPicked(file: File | null) {
    if (!file) return;
    const res = await uploadImage(file);
    if ("error" in res) {
      setActionError(res.error);
      return;
    }
    update({ imageUrl: res.url });
  }

  async function publish() {
    if (busy) return;
    setBusy("publish");
    setActionError(null);
    const ok = await flushSave();
    if (!ok) {
      setActionError("Couldn't save the draft — publish aborted");
      setBusy(null);
      return;
    }
    const res = await fetch(`/api/blog/${id}/publish`, { method: "POST" });
    const j = await res.json().catch(() => null);
    if (res.ok && j?.post) setPost(j.post as BlogPost);
    else setActionError(j?.error ?? "Publish failed");
    setBusy(null);
  }

  async function unpublish() {
    if (busy) return;
    setMenuOpen(false);
    setBusy("unpublish");
    setActionError(null);
    const res = await fetch(`/api/blog/${id}/publish`, { method: "DELETE" });
    const j = await res.json().catch(() => null);
    if (res.ok && j?.post) setPost(j.post as BlogPost);
    else setActionError(j?.error ?? "Unpublish failed");
    setBusy(null);
  }

  async function destroy() {
    if (busy) return;
    setMenuOpen(false);
    if (!window.confirm("Delete this post permanently? This can't be undone.")) return;
    setBusy("delete");
    const res = await fetch(`/api/blog/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/blog");
      return;
    }
    setActionError("Delete failed");
    setBusy(null);
  }

  if (loadError) {
    return (
      <main className="tool-main">
        <div className="dash-empty">
          Post not found. <Link href="/blog">Back to The Front Page</Link>
        </div>
      </main>
    );
  }
  if (!post || !draft) {
    return (
      <main className="tool-main">
        <div className="dash-empty">Loading editor…</div>
      </main>
    );
  }

  const isPublished = post.status === "published";
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Save failed"
        : saveState === "saved"
          ? "Saved"
          : "";

  return (
    <main className="blog-editor2">
      <div className="blog-ed-bar">
        <div className="blog-ed-bar-left">
          <Link className="tool-btn" href="/blog">
            ← Posts
          </Link>
          <span
            className={`blog-badge ${
              isPublished
                ? post.hasUnpublishedChanges
                  ? "blog-badge--dirty"
                  : "blog-badge--live"
                : "blog-badge--draft"
            }`}
          >
            {isPublished
              ? post.hasUnpublishedChanges
                ? "Edited since publish"
                : "Published"
              : "Draft"}
          </span>
          <span className="blog-save-state" aria-live="polite">
            {saveLabel}
          </span>
        </div>
        <div className="blog-ed-bar-actions">
          <button
            className="tool-btn"
            type="button"
            onClick={() => bodyFileRef.current?.click()}
            title="Insert an image at the cursor"
          >
            + Image
          </button>
          <button
            className="tool-btn"
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            Settings
          </button>
          <a
            className="tool-btn"
            href={`/press/${draft.slug || post.slug || ""}?draft=1`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Preview
          </a>
          <button
            className="tool-btn tool-btn--solid"
            type="button"
            onClick={publish}
            disabled={busy !== null}
          >
            {busy === "publish"
              ? "Publishing…"
              : isPublished
                ? "Publish changes"
                : "Publish"}
          </button>
          <div className="blog-ed-menu-wrap">
            <button
              className="tool-btn"
              type="button"
              aria-label="More actions"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="blog-ed-menu">
                {isPublished && (
                  <button type="button" onClick={unpublish} disabled={busy !== null}>
                    {busy === "unpublish" ? "Unpublishing…" : "Unpublish"}
                  </button>
                )}
                <button
                  type="button"
                  className="blog-ed-menu-danger"
                  onClick={destroy}
                  disabled={busy !== null}
                >
                  {busy === "delete" ? "Deleting…" : "Delete post"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div className="blog-ed-settings">
          <div className="tool-field">
            <label>URL slug {post.publishedAt ? "(locked after publish)" : ""}</label>
            <input
              className="tool-input"
              value={draft.slug}
              disabled={Boolean(post.publishedAt)}
              onChange={(e) => {
                setSlugTouched(true);
                update({ slug: slugify(e.target.value) || e.target.value.toLowerCase() });
              }}
              placeholder="my-post-url"
            />
          </div>
          <div className="tool-field">
            <label>Category</label>
            <select
              className="tool-select"
              value={draft.category}
              onChange={(e) => update({ category: e.target.value })}
            >
              {(CATEGORIES.includes(draft.category)
                ? CATEGORIES
                : [draft.category, ...CATEGORIES]
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="tool-field">
            <label>Display date</label>
            <input
              className="tool-input"
              value={draft.displayDate}
              onChange={(e) => update({ displayDate: e.target.value })}
              placeholder="m/d/yy"
            />
          </div>
        </div>
      )}

      {actionError && <div className="blog-editor-error">{actionError}</div>}

      <div className="site blog-doc">
        <div className="blog-doc-inner">
          <div className="fp-folio">
            <span>{draft.category || "Dispatch"}</span>
            <span>{draft.displayDate}</span>
          </div>
          <GrowingText
            className="blog-doc-title fp-headline fp-headline--xl"
            value={draft.title}
            onChange={onTitleChange}
            placeholder="Post title"
          />
          <GrowingText
            className="blog-doc-deck fp-deck"
            value={draft.excerpt}
            onChange={(v) => update({ excerpt: v })}
            placeholder="Add a subtitle…"
          />
          <div className="fp-byline">By Paperboy Ventures · New York</div>

          <div className="blog-doc-cover">
            {draft.imageUrl ? (
              <figure className="site-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.imageUrl} alt="" />
                <div className="blog-doc-cover-actions">
                  <button type="button" onClick={() => coverFileRef.current?.click()}>
                    Replace
                  </button>
                  <button type="button" onClick={() => update({ imageUrl: "" })}>
                    Remove
                  </button>
                </div>
              </figure>
            ) : (
              <button
                type="button"
                className="blog-doc-cover-add"
                onClick={() => coverFileRef.current?.click()}
              >
                + Add a cover image
              </button>
            )}
          </div>

          {editor && (
            <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }} className="blog-bubble">
              <BubbleButton
                editor={editor}
                active={editor.isActive("bold")}
                title="Bold"
                label={<strong>B</strong>}
                onClick={() => editor.chain().focus().toggleBold().run()}
              />
              <BubbleButton
                editor={editor}
                active={editor.isActive("italic")}
                title="Italic"
                label={<em>i</em>}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              />
              <BubbleButton
                editor={editor}
                active={editor.isActive("heading", { level: 2 })}
                title="Heading"
                label="H"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              />
              <BubbleButton
                editor={editor}
                active={editor.isActive("blockquote")}
                title="Quote"
                label={"“”"}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
              <BubbleButton
                editor={editor}
                active={editor.isActive("bulletList")}
                title="Bulleted list"
                label="•"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
              <BubbleButton
                editor={editor}
                active={editor.isActive("orderedList")}
                title="Numbered list"
                label="1."
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
              <BubbleButton
                editor={editor}
                active={editor.isActive("link")}
                title="Link"
                label="🔗"
                onClick={setLink}
              />
            </BubbleMenu>
          )}
          <div className="fp-body blog-doc-body">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      <input
        ref={coverFileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void onCoverPicked(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <input
        ref={bodyFileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && editorRef.current) void insertUploadedImage(editorRef.current, f);
          e.target.value = "";
        }}
      />
    </main>
  );
}
