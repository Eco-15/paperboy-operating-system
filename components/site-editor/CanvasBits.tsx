"use client";

// Shared pieces of the WYSIWYG canvases: selection wiring, the block toolbar,
// the link popover, the editable image "cut" (with alt), and the editable
// paragraph list (rich text + Enter-split / Backspace-merge + caret focus).

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import type { Story } from "@/lib/site-content/schema";
import {
  deleteParagraph,
  mergeParagraph,
  setParagraph,
  splitParagraph,
} from "@/lib/site-content/mutations";
import { inlineToText, parseInline } from "@/lib/site-content/inlineMarkdown";
import EditableText, { placeCaret } from "./EditableText";
import AssetPicker from "./AssetPicker";
import { useEditorUi, type BlockActions } from "./EditorContext";

// Selection wiring for a block: returns the selected flag, props to spread on
// the block element, and registers keyboard actions (Delete / Cmd+D).
export function useSelectable(id: string, actions: BlockActions) {
  const { selectedId, select, registerBlock } = useEditorUi();
  useEffect(() => registerBlock(id, actions));
  return {
    selected: selectedId === id,
    selectProps: {
      onMouseDown: (e: React.MouseEvent) => {
        e.stopPropagation();
        select(id);
      },
    },
  };
}

export function ToolbarButton({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="se-tb-btn"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function BlockToolbar({ children }: { children: React.ReactNode }) {
  return <div className="se-toolbar">{children}</div>;
}

// Popover editing where a story points: its main link plus the optional
// "xref" line at the foot of the article.
export function LinkPopover({
  story,
  onApply,
  onClose,
}: {
  story: Story;
  onApply: (patch: Partial<Story>) => void;
  onClose: () => void;
}) {
  const [href, setHref] = useState(story.href);
  const [external, setExternal] = useState(!!story.external);
  const [xrefLabel, setXrefLabel] = useState(story.xref?.label ?? "");
  const [xrefHref, setXrefHref] = useState(story.xref?.href ?? "");

  function apply() {
    const label = xrefLabel.trim();
    const target = xrefHref.trim();
    onApply({
      href: href.trim() || "/",
      external: external || undefined,
      xref:
        label && target
          ? {
              label,
              href: target,
              external: /^https?:\/\//.test(target) || undefined,
            }
          : undefined,
    });
    onClose();
  }

  return (
    <div className="se-popover" onClick={(e) => e.stopPropagation()}>
      <label className="se-pop-field">
        <span>Headline links to</span>
        <input
          className="tool-input"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          placeholder="/portfolio or https://…"
        />
      </label>
      <label className="se-pop-check">
        <input
          type="checkbox"
          checked={external}
          onChange={(e) => setExternal(e.target.checked)}
        />
        <span>Opens in a new tab</span>
      </label>
      <label className="se-pop-field">
        <span>Cross-reference line (optional)</span>
        <input
          className="tool-input"
          value={xrefLabel}
          onChange={(e) => setXrefLabel(e.target.value)}
          placeholder="See the full portfolio →"
        />
      </label>
      <label className="se-pop-field">
        <span>Cross-reference target</span>
        <input
          className="tool-input"
          value={xrefHref}
          onChange={(e) => setXrefHref(e.target.value)}
          placeholder="/portfolio"
        />
      </label>
      <div className="se-pop-actions">
        <button type="button" className="tool-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="tool-btn tool-btn--solid" onClick={apply}>
          Done
        </button>
      </div>
    </div>
  );
}

// An editable newspaper cut: click the image to swap it, edit the caption
// inline, set alt text, or remove/add the image entirely.
export function EditableCut({
  cut,
  onChange,
  addLabel = "+ Add image",
}: {
  cut?: { src: string; caption: string; alt?: string };
  onChange: (cut?: { src: string; caption: string; alt?: string }) => void;
  addLabel?: string;
}) {
  const [picking, setPicking] = useState(false);

  const picker = picking ? (
    <AssetPicker
      onPick={(src) => {
        onChange({ ...cut, src, caption: cut?.caption ?? "New caption" });
        setPicking(false);
      }}
      onClose={() => setPicking(false)}
    />
  ) : null;

  if (!cut) {
    return (
      <>
        <button
          type="button"
          className="se-add-cut"
          onClick={() => setPicking(true)}
        >
          {addLabel}
        </button>
        {picker}
      </>
    );
  }

  return (
    <figure className="fp-cut">
      <div className="fp-cut-img se-cut-img">
        <img src={cut.src} alt={cut.alt ?? cut.caption} />
        <div className="se-cut-actions">
          <button type="button" onClick={() => setPicking(true)}>
            Change
          </button>
          <button
            type="button"
            title="Describe the image for screen readers & SEO"
            onClick={() => {
              const alt = window.prompt(
                "Describe this image (alt text for screen readers & SEO):",
                cut.alt ?? cut.caption,
              );
              if (alt !== null) {
                onChange({ ...cut, alt: alt.trim() || undefined });
              }
            }}
          >
            Alt
          </button>
          <button type="button" onClick={() => onChange(undefined)}>
            Remove
          </button>
        </div>
      </div>
      <figcaption className="fp-cut-cap">
        <EditableText
          value={cut.caption}
          onCommit={(caption) => onChange({ ...cut, caption })}
          placeholder="Caption"
        />
      </figcaption>
      {picker}
    </figure>
  );
}

// Editable list of rich paragraphs. Enter splits at the caret, Backspace at
// the start merges into the previous paragraph, clearing a paragraph deletes
// it. After a structural change the caret is restored via data-sepath.
export function EditableBody({
  body,
  onChange,
  className,
  pathPrefix,
  extraChildren,
}: {
  body: string[];
  onChange: (body: string[]) => void;
  className: string;
  pathPrefix: string;
  extraChildren?: React.ReactNode;
}) {
  const focusReq = useRef<{ index: number; caret: number | "start" | "end" } | null>(
    null,
  );

  useEffect(() => {
    if (!focusReq.current) return;
    const { index, caret } = focusReq.current;
    focusReq.current = null;
    const el = document.querySelector<HTMLElement>(
      `[data-sepath="${pathPrefix}.${index}"]`,
    );
    if (el) {
      el.focus();
      placeCaret(el, caret);
    }
  });

  return (
    <div className={className}>
      {body.length === 0 ? (
        <button
          type="button"
          className="se-add-inline"
          onClick={() => onChange(["New paragraph."])}
        >
          + Add paragraph
        </button>
      ) : null}
      {body.map((p, i) => (
        <EditableText
          key={`${body.length}:${i}`}
          as="p"
          rich
          value={p}
          sePath={`${pathPrefix}.${i}`}
          placeholder="Paragraph — clear to remove"
          onCommit={(text) =>
            onChange(
              text === "" ? deleteParagraph(body, i) : setParagraph(body, i, text),
            )
          }
          onSplit={(before, after) => {
            focusReq.current = { index: i + 1, caret: "start" };
            onChange(splitParagraph(body, i, before, after));
          }}
          onMergeBack={
            i === 0
              ? undefined
              : (currentText) => {
                  const prevLen = inlineToText(parseInline(body[i - 1])).length;
                  focusReq.current = { index: i - 1, caret: prevLen + 1 };
                  onChange(mergeParagraph(setParagraph(body, i, currentText), i));
                }
          }
        />
      ))}
      {extraChildren}
    </div>
  );
}
