"use client";

// The Press Room — Wix-like editor for the public site. v2: click-to-select
// blocks with pinned toolbars, undo/redo, delete/add/duplicate everywhere,
// cross-row drag, inline bold/italic/link, page settings (section/kicker/SEO),
// and an in-canvas preview mode. Renders the real broadsheet inside a `.site`
// canvas (globals.css is app-wide, so the newsprint look is exact).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sheet from "@/components/site/Sheet";
import type { SitePageContent, SitePageSlug } from "@/lib/site-content/schema";
import { PAGE_DEFAULTS, SHEET_DEFAULTS } from "@/lib/site-content/defaults";
import { docReducer, initialDocState, type DocState } from "./editorState";
import { EditorUiContext, type BlockActions } from "./EditorContext";
import BubbleToolbar from "./BubbleToolbar";
import PageSettingsModal from "./PageSettingsModal";
import HomeCanvas from "./HomeCanvas";
import PortfolioCanvas from "./PortfolioCanvas";
import {
  AboutCanvas,
  ApplyCanvas,
  DealsCanvas,
  JobsCanvas,
  ApplyPreview,
  JobsPreview,
  DealsPreview,
} from "./SimplePageCanvas";
import HomeBroadsheet from "@/components/site/broadsheet/HomeBroadsheet";
import AboutEditorial from "@/components/site/broadsheet/AboutEditorial";
import SectionHeader from "@/components/site/broadsheet/SectionHeader";
import PortfolioGrid from "@/components/site/broadsheet/PortfolioGrid";

type Slug = SitePageSlug;
type Content = SitePageContent[Slug];
export type CommitFn = (next: Content, opts?: { base?: Content }) => void;

const PAGES: { slug: Slug; label: string; path: string }[] = [
  { slug: "home", label: "Front Page", path: "/" },
  { slug: "about", label: "About", path: "/about" },
  { slug: "apply", label: "Apply", path: "/apply" },
  { slug: "jobs", label: "Jobs", path: "/jobs" },
  { slug: "deals", label: "DEALS", path: "/deals" },
  { slug: "portfolio", label: "Portfolio", path: "/portfolio" },
];

type Version = { id: string; createdAt: string; publishedBy: string | null };

const AUTOSAVE_MS = 1500;

export default function SiteEditorApp() {
  const [slug, setSlug] = useState<Slug>("home");
  const [doc, setDoc] = useState<DocState<Content>>(initialDocState<Content>());
  // Which page the current doc actually belongs to. Switching pages re-renders
  // with the new `slug` BEFORE the load effect runs, so without this the new
  // page's canvas would receive the previous page's content for one frame
  // (e.g. AboutCanvas reading `aside` from Front-Page content → crash).
  const [loadedSlug, setLoadedSlug] = useState<Slug | null>(null);
  const [published, setPublished] = useState<unknown>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [publishing, setPublishing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const docRef = useRef(doc);
  const savedAtRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugRef = useRef<Slug>(slug);
  const actionsRef = useRef(new Map<string, BlockActions>());

  const page = PAGES.find((p) => p.slug === slug)!;
  const draft = doc.present;

  // Synchronous reducer application so refs stay in step with state.
  const apply = useCallback(
    (action: Parameters<typeof docReducer<Content>>[1]) => {
      const next = docReducer(docRef.current, action);
      docRef.current = next;
      setDoc(next);
      return next;
    },
    [],
  );

  const doSave = useCallback(async () => {
    const content = docRef.current.present;
    const forSlug = slugRef.current;
    if (!content) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/site-editor/pages/${forSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, baseSavedAt: savedAtRef.current }),
      });
      if (res.status === 409) {
        setError("This page was edited somewhere else — reloading the latest draft.");
        await load(forSlug);
        return;
      }
      if (!res.ok) throw new Error("Save failed.");
      const data = await res.json();
      savedAtRef.current = data.draftSavedAt;
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Save failed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback(() => {
    setSaveState("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void doSave();
    }, AUTOSAVE_MS);
  }, [doSave]);

  const load = useCallback(
    async (nextSlug: Slug) => {
      setLoading(true);
      setError(null);
      setHistoryOpen(false);
      setVersions(null);
      setSelectedId(null);
      try {
        const res = await fetch(`/api/site-editor/pages/${nextSlug}`);
        if (!res.ok) throw new Error("Could not load the page.");
        const data = await res.json();
        savedAtRef.current = data.draftSavedAt;
        apply({ type: "load", content: data.draft });
        setLoadedSlug(nextSlug);
        setPublished(data.published);
        setPublishedAt(data.publishedAt);
        setSaveState("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed.");
      } finally {
        setLoading(false);
      }
    },
    [apply],
  );

  useEffect(() => {
    slugRef.current = slug;
    void load(slug);
  }, [slug, load]);

  const commit = useCallback<CommitFn>(
    (next, opts) => {
      apply({ type: "commit", next, base: opts?.base });
      setError(null);
      scheduleSave();
    },
    [apply, scheduleSave],
  );

  const transient = useCallback(
    (next: Content) => {
      apply({ type: "transient", next });
    },
    [apply],
  );

  const undo = useCallback(() => {
    const before = docRef.current;
    const after = apply({ type: "undo" });
    if (after !== before) scheduleSave();
  }, [apply, scheduleSave]);

  const redo = useCallback(() => {
    const before = docRef.current;
    const after = apply({ type: "redo" });
    if (after !== before) scheduleSave();
  }, [apply, scheduleSave]);

  // Flush any pending debounce (before publish / page switch).
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      await doSave();
    }
  }, [doSave]);

  // ── global keyboard: undo/redo, delete, duplicate, escape ──
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return (
        el.isContentEditable ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT"
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        if (isTyping()) return; // native text undo while a field is focused
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (isTyping()) return;
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        actionsRef.current.get(selectedId)?.delete?.();
        setSelectedId(null);
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        actionsRef.current.get(selectedId)?.duplicate?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, undo, redo]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (saveState === "pending" || saveState === "saving") e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  const editorUi = useMemo(
    () => ({
      selectedId,
      select: setSelectedId,
      registerBlock: (id: string, actions: BlockActions) => {
        actionsRef.current.set(id, actions);
        return () => {
          if (actionsRef.current.get(id) === actions) {
            actionsRef.current.delete(id);
          }
        };
      },
    }),
    [selectedId],
  );

  const unpublishedChanges = useMemo(() => {
    if (!draft) return false;
    const live = published ?? PAGE_DEFAULTS[slug];
    return JSON.stringify(draft) !== JSON.stringify(live);
  }, [draft, published, slug]);

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      await flush();
      const res = await fetch(`/api/site-editor/pages/${slug}/publish`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Publish failed.");
      const data = await res.json();
      setPublished(docRef.current.present);
      setPublishedAt(data.publishedAt);
      setVersions(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  async function revert(versionId?: string) {
    if (
      !versionId &&
      !window.confirm("Discard the draft and restore the live version?")
    ) {
      return;
    }
    setError(null);
    try {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const res = await fetch(`/api/site-editor/pages/${slug}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(versionId ? { versionId } : {}),
      });
      if (!res.ok) throw new Error("Revert failed.");
      const data = await res.json();
      savedAtRef.current = data.draftSavedAt;
      apply({ type: "load", content: data.draft });
      setSaveState("saved");
      setHistoryOpen(false);
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revert failed.");
    }
  }

  async function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && versions === null) {
      try {
        const res = await fetch(`/api/site-editor/pages/${slug}/versions`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setVersions(data.versions ?? []);
      } catch {
        setVersions([]);
      }
    }
  }

  async function switchPage(next: Slug) {
    if (next === slug) return;
    await flush();
    setSlug(next);
  }

  function togglePreview() {
    // Blur first so any in-progress text edit commits before preview renders.
    (document.activeElement as HTMLElement | null)?.blur?.();
    setSelectedId(null);
    setMode((m) => (m === "edit" ? "preview" : "edit"));
  }

  const saveLabel =
    saveState === "pending" || saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : "";

  function interceptLinks(e: React.MouseEvent) {
    const anchor = (e.target as HTMLElement).closest("a");
    if (anchor) e.preventDefault();
  }

  const sheet =
    (draft && "sheet" in draft && draft.sheet) || SHEET_DEFAULTS[slug];

  function renderCanvas() {
    if (!draft) return null;
    if (mode === "preview") {
      switch (slug) {
        case "home":
          return <HomeBroadsheet content={draft as SitePageContent["home"]} />;
        case "about":
          return <AboutEditorial content={draft as SitePageContent["about"]} />;
        case "apply":
          return <ApplyPreview content={draft as SitePageContent["apply"]} />;
        case "jobs":
          return <JobsPreview content={draft as SitePageContent["jobs"]} />;
        case "deals":
          return <DealsPreview content={draft as SitePageContent["deals"]} />;
        case "portfolio": {
          const c = draft as SitePageContent["portfolio"];
          return (
            <>
              <SectionHeader title={c.title} deck={c.deck} byline={c.byline} />
              <PortfolioGrid content={c} />
            </>
          );
        }
      }
    }
    switch (slug) {
      case "home":
        return (
          <HomeCanvas
            content={draft as SitePageContent["home"]}
            onCommit={commit as CommitFn}
            onTransient={transient}
          />
        );
      case "about":
        return (
          <AboutCanvas
            content={draft as SitePageContent["about"]}
            onCommit={commit}
          />
        );
      case "apply":
        return (
          <ApplyCanvas
            content={draft as SitePageContent["apply"]}
            onCommit={commit}
          />
        );
      case "jobs":
        return (
          <JobsCanvas
            content={draft as SitePageContent["jobs"]}
            onCommit={commit}
          />
        );
      case "deals":
        return (
          <DealsCanvas
            content={draft as SitePageContent["deals"]}
            onCommit={commit}
          />
        );
      case "portfolio":
        return (
          <PortfolioCanvas
            content={draft as SitePageContent["portfolio"]}
            onCommit={commit}
          />
        );
    }
  }

  return (
    <EditorUiContext.Provider value={editorUi}>
      <div className="se-app">
        <div className="se-header">
          <div className="se-pages">
            {PAGES.map((p) => (
              <button
                key={p.slug}
                className={`se-page-btn${p.slug === slug ? " se-page-btn--active" : ""}`}
                onClick={() => void switchPage(p.slug)}
              >
                {p.label}
              </button>
            ))}
            <span
              className="se-page-btn se-page-btn--disabled"
              title="The Blog is managed from the Blog tool — not editable here."
            >
              The Blog
            </span>
          </div>

          <div className="se-actions">
            <span
              className={`se-save-state${saveState === "error" ? " se-save-state--error" : ""}`}
            >
              {saveLabel}
            </span>
            <div className="se-device se-undo-group" role="group" aria-label="Undo / redo">
              <button
                className="se-device-btn"
                title="Undo (⌘Z)"
                disabled={doc.past.length === 0}
                onClick={undo}
              >
                ↶
              </button>
              <button
                className="se-device-btn"
                title="Redo (⇧⌘Z)"
                disabled={doc.future.length === 0}
                onClick={redo}
              >
                ↷
              </button>
            </div>
            <div className="se-device" role="group" aria-label="Preview width">
              <button
                className={`se-device-btn${device === "desktop" ? " se-device-btn--active" : ""}`}
                title="Desktop width"
                onClick={() => setDevice("desktop")}
              >
                ⬜
              </button>
              <button
                className={`se-device-btn${device === "mobile" ? " se-device-btn--active" : ""}`}
                title="Mobile width"
                onClick={() => setDevice("mobile")}
              >
                ▯
              </button>
            </div>
            <button
              className={`tool-btn${mode === "preview" ? " se-preview-active" : ""}`}
              title="Toggle in-canvas preview (hides editing chrome)"
              onClick={togglePreview}
            >
              {mode === "preview" ? "✎ Edit" : "👁 Preview"}
            </button>
            <button
              className="tool-btn se-gear"
              title="Page settings — section, kicker, SEO"
              onClick={() => setSettingsOpen(true)}
            >
              ⚙ Settings
            </button>
            <a
              className="tool-btn"
              href={`${page.path}?draft=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open draft
            </a>
            <button className="tool-btn" onClick={toggleHistory}>
              History
            </button>
            <button
              className="tool-btn"
              disabled={!unpublishedChanges}
              title="Discard draft edits and restore the live version"
              onClick={() => void revert()}
            >
              Revert
            </button>
            <button
              className="tool-btn tool-btn--solid"
              disabled={!unpublishedChanges || publishing || loading}
              onClick={() => void publish()}
            >
              {publishing ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>

        {historyOpen ? (
          <div className="se-history">
            {versions === null ? (
              <span className="se-hint">Loading history…</span>
            ) : versions.length === 0 ? (
              <span className="se-hint">
                No published versions yet — Publish creates the first snapshot.
              </span>
            ) : (
              versions.map((v) => (
                <button
                  key={v.id}
                  className="se-version"
                  title="Restore this version into the draft"
                  onClick={() => void revert(v.id)}
                >
                  {new Date(v.createdAt).toLocaleString()}
                </button>
              ))
            )}
          </div>
        ) : null}

        {error ? <div className="se-error">{error}</div> : null}
        {publishedAt ? (
          <div className="se-meta">
            Live version published {new Date(publishedAt).toLocaleString()}
            {unpublishedChanges
              ? " · draft has unpublished changes"
              : " · draft matches the live page"}
          </div>
        ) : (
          <div className="se-meta">
            This page has never been published from the editor — the live site
            shows the built-in copy
            {unpublishedChanges ? "; the draft has changes" : ""}.
          </div>
        )}

        <div className="se-stage" onMouseDown={() => setSelectedId(null)}>
          {loading || !draft || loadedSlug !== slug ? (
            <div className="se-loading">Loading the page…</div>
          ) : (
            <div
              key={`${slug}:${doc.revision}:${mode}`}
              className="site se-canvas"
              data-device={device}
              data-mode={mode}
              onClickCapture={interceptLinks}
            >
              <Sheet
                section={sheet.section}
                kicker={sheet.kicker}
                isFront={slug === "home"}
              >
                {renderCanvas()}
              </Sheet>
            </div>
          )}
        </div>

        {mode === "edit" ? <BubbleToolbar /> : null}
        {settingsOpen && draft ? (
          <PageSettingsModal
            slug={slug}
            content={draft}
            onApply={(patch) => {
              commit({ ...draft, ...patch } as Content);
              setSettingsOpen(false);
            }}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}
      </div>
    </EditorUiContext.Provider>
  );
}
