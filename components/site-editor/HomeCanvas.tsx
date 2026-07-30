"use client";

// WYSIWYG canvas for the front page. Mirrors the markup of
// components/site/broadsheet/HomeBroadsheet.tsx exactly (same class recipes)
// but swaps text nodes for EditableText, wraps blocks in selection + dnd-kit
// sortables, and adds toolbars. v2: cross-row drag, drag-onto-lead swap,
// classifieds CRUD/reorder, duplicate, empty rows. Keep files in sync.

import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HomeContent, Story } from "@/lib/site-content/schema";
import { LEAD_BYLINE_FALLBACK } from "@/components/site/broadsheet/HomeBroadsheet";
import {
  addClassified,
  addParagraph,
  addStory,
  deleteClassified,
  deleteStory,
  duplicateClassified,
  duplicateStory,
  moveClassified,
  moveStory,
  moveStoryAcross,
  promoteToLead,
  updateClassified,
  updateLead,
  updateStory,
  type StoryRow,
} from "@/lib/site-content/mutations";
import EditableText from "./EditableText";
import {
  BlockToolbar,
  EditableBody,
  EditableCut,
  LinkPopover,
  ToolbarButton,
  useSelectable,
} from "./CanvasBits";

type CommitOpts = { base?: HomeContent };
type Props = {
  content: HomeContent;
  onCommit: (next: HomeContent, opts?: CommitOpts) => void;
  onTransient: (next: HomeContent) => void;
};

const ROWS: StoryRow[] = ["columnStories", "footStories"];

function rowOf(content: HomeContent, storyId: string): StoryRow | null {
  for (const row of ROWS) {
    if (content[row].some((s) => s.id === storyId)) return row;
  }
  return null;
}

const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : closestCorners(args);
};

function EditableXref({
  story,
  onCommit,
}: {
  story: Story;
  onCommit: (label: string) => void;
}) {
  if (!story.xref) return null;
  return (
    <span className="sheet-xref">
      <EditableText value={story.xref.label} onCommit={onCommit} />
    </span>
  );
}

function EditableByline({
  story,
  onPatch,
  fallback,
}: {
  story: Story;
  onPatch: (patch: Partial<Story>) => void;
  fallback?: string;
}) {
  if (story.byline === undefined && !fallback) return null;
  return (
    <div className="fp-byline">
      <EditableText
        value={story.byline ?? fallback ?? ""}
        placeholder="Byline — clear to remove"
        onCommit={(b) => onPatch({ byline: b || undefined })}
      />
    </div>
  );
}

function StoryCard({
  story,
  row,
  index,
  count,
  content,
  onCommit,
  variant,
}: {
  story: Story;
  row: StoryRow;
  index: number;
  count: number;
  content: HomeContent;
  onCommit: Props["onCommit"];
  variant: "column" | "foot";
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const blockId = `${row}|${story.id}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: blockId });
  const { selected, selectProps } = useSelectable(blockId, {
    delete: () => onCommit(deleteStory(content, row, story.id)),
    duplicate: () => onCommit(duplicateStory(content, row, story.id)),
  });

  const patch = (p: Partial<Story>) =>
    onCommit(updateStory(content, row, story.id, p));

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...selectProps}
      className={[
        "fp-article",
        variant === "foot" ? "sheet-foot-article" : "",
        "se-block",
        selected ? "se-block--selected" : "",
        isDragging ? "se-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <BlockToolbar>
        <span
          className="se-tb-btn se-tb-drag"
          title="Drag to move — within a row, between rows, or onto the lead"
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>
        <ToolbarButton
          label="◀"
          title="Move earlier"
          disabled={index === 0}
          onClick={() => onCommit(moveStory(content, row, index, index - 1))}
        />
        <ToolbarButton
          label="▶"
          title="Move later"
          disabled={index === count - 1}
          onClick={() => onCommit(moveStory(content, row, index, index + 1))}
        />
        <ToolbarButton
          label="★"
          title="Make this the lead story (swaps with the current lead)"
          onClick={() => onCommit(promoteToLead(content, row, story.id))}
        />
        <ToolbarButton
          label="⧉"
          title="Duplicate (⌘D)"
          onClick={() => onCommit(duplicateStory(content, row, story.id))}
        />
        <ToolbarButton label="🔗" title="Edit links" onClick={() => setLinkOpen(true)} />
        <ToolbarButton
          label="¶+"
          title="Add a paragraph"
          onClick={() => patch({ body: addParagraph(story.body) })}
        />
        {story.byline === undefined ? (
          <ToolbarButton
            label="By"
            title="Add a byline"
            onClick={() => patch({ byline: "By The Paperboy Desk" })}
          />
        ) : null}
        <ToolbarButton
          label="✕"
          title="Delete this story (Del)"
          onClick={() => onCommit(deleteStory(content, row, story.id))}
        />
      </BlockToolbar>
      {linkOpen ? (
        <LinkPopover story={story} onApply={patch} onClose={() => setLinkOpen(false)} />
      ) : null}

      {variant === "column" ? (
        <>
          <h2 className="fp-headline">
            <EditableText
              value={story.headline}
              onCommit={(headline) => patch({ headline })}
            />
          </h2>
          <EditableCut cut={story.cut} onChange={(c) => patch({ cut: c })} />
          <p className="fp-deck fp-deck--sm">
            <EditableText
              rich
              value={story.deck ?? ""}
              placeholder="Deck (optional)"
              onCommit={(d) => patch({ deck: d || undefined })}
            />
          </p>
          <EditableByline story={story} onPatch={patch} />
          <EditableBody
            className="fp-body"
            body={story.body}
            pathPrefix={blockId}
            onChange={(b) => patch({ body: b })}
          />
          <EditableXref
            story={story}
            onCommit={(label) => patch({ xref: { ...story.xref!, label } })}
          />
        </>
      ) : (
        <>
          <h2 className="fp-headline">
            <EditableText
              value={story.headline}
              onCommit={(headline) => patch({ headline })}
            />
          </h2>
          <div className="sheet-foot-grid">
            <EditableCut cut={story.cut} onChange={(c) => patch({ cut: c })} />
            <div>
              <p className="fp-deck fp-deck--sm">
                <EditableText
                  rich
                  value={story.deck ?? ""}
                  placeholder="Deck (optional)"
                  onCommit={(d) => patch({ deck: d || undefined })}
                />
              </p>
              <EditableByline story={story} onPatch={patch} />
              <EditableBody
                className="fp-body"
                body={story.body}
                pathPrefix={blockId}
                onChange={(b) => patch({ body: b })}
              />
              <EditableXref
                story={story}
                onCommit={(label) => patch({ xref: { ...story.xref!, label } })}
              />
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function LeadCanvas({
  content,
  onCommit,
}: {
  content: HomeContent;
  onCommit: Props["onCommit"];
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const story = content.lead;
  const patch = (p: Partial<Story>) => onCommit(updateLead(content, p));
  const { selected, selectProps } = useSelectable("lead", {});
  const { setNodeRef, isOver } = useDroppable({ id: "lead-drop" });

  return (
    <article
      ref={setNodeRef}
      {...selectProps}
      className={[
        "fp-article",
        "fp-lead",
        "se-block",
        selected ? "se-block--selected" : "",
        isOver ? "se-lead-droptarget" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <BlockToolbar>
        <span className="se-tb-label">Lead story — drop any story here to swap</span>
        <ToolbarButton label="🔗" title="Edit links" onClick={() => setLinkOpen(true)} />
        <ToolbarButton
          label="¶+"
          title="Add a paragraph"
          onClick={() => patch({ body: addParagraph(story.body) })}
        />
      </BlockToolbar>
      {linkOpen ? (
        <LinkPopover story={story} onApply={patch} onClose={() => setLinkOpen(false)} />
      ) : null}
      <h2 className="fp-headline fp-headline--xl">
        <EditableText
          value={story.headline}
          onCommit={(headline) => patch({ headline })}
        />
      </h2>
      <p className="fp-deck">
        <EditableText
          rich
          value={story.deck ?? ""}
          placeholder="Deck"
          onCommit={(d) => patch({ deck: d || undefined })}
        />
      </p>
      <EditableByline story={story} onPatch={patch} fallback={LEAD_BYLINE_FALLBACK} />
      <div className="fp-lead-grid">
        <EditableCut cut={story.cut} onChange={(c) => patch({ cut: c })} />
        <EditableBody
          className="fp-body fp-body--2"
          body={story.body}
          pathPrefix="lead"
          onChange={(b) => patch({ body: b })}
          extraChildren={
            <EditableXref
              story={story}
              onCommit={(label) => patch({ xref: { ...story.xref!, label } })}
            />
          }
        />
      </div>
    </article>
  );
}

function ClassifiedBlock({
  classified,
  index,
  content,
  onCommit,
}: {
  classified: HomeContent["classifieds"][number];
  index: number;
  content: HomeContent;
  onCommit: Props["onCommit"];
}) {
  const blockId = `classified|${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: blockId });
  const { selected, selectProps } = useSelectable(blockId, {
    delete: () => onCommit(deleteClassified(content, index)),
    duplicate: () => onCommit(duplicateClassified(content, index)),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState(classified.href);

  return (
    <span
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...selectProps}
      className={[
        "sheet-classified",
        "se-classified",
        "se-block",
        selected ? "se-block--selected" : "",
        isDragging ? "se-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <BlockToolbar>
        <span className="se-tb-btn se-tb-drag" title="Drag to reorder" {...attributes} {...listeners}>
          ⠿
        </span>
        <ToolbarButton
          label="🔗"
          title="Edit where this notice links"
          onClick={() => {
            setHref(classified.href);
            setLinkOpen(true);
          }}
        />
        <ToolbarButton
          label="⧉"
          title="Duplicate (⌘D)"
          onClick={() => onCommit(duplicateClassified(content, index))}
        />
        <ToolbarButton
          label="✕"
          title="Delete this notice (Del)"
          onClick={() => onCommit(deleteClassified(content, index))}
        />
      </BlockToolbar>
      {linkOpen ? (
        <div className="se-popover" onClick={(e) => e.stopPropagation()}>
          <label className="se-pop-field">
            <span>Links to</span>
            <input
              className="tool-input"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/apply"
            />
          </label>
          <div className="se-pop-actions">
            <button type="button" className="tool-btn" onClick={() => setLinkOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="tool-btn tool-btn--solid"
              onClick={() => {
                onCommit(updateClassified(content, index, { href: href.trim() || "/" }));
                setLinkOpen(false);
              }}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
      <div className="sheet-classified-kicker">
        <EditableText
          value={classified.kicker}
          onCommit={(kicker) => onCommit(updateClassified(content, index, { kicker }))}
        />
      </div>
      <div className="sheet-classified-line">
        <EditableText
          value={classified.line}
          onCommit={(line) => onCommit(updateClassified(content, index, { line }))}
        />
      </div>
    </span>
  );
}

function StoryRowGrid({
  row,
  content,
  onCommit,
  variant,
}: {
  row: StoryRow;
  content: HomeContent;
  onCommit: Props["onCommit"];
  variant: "column" | "foot";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `row:${row}` });
  const stories = content[row];
  return (
    <SortableContext
      items={stories.map((s) => `${row}|${s.id}`)}
      strategy={rectSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={[
          variant === "column" ? "fp-row" : "sheet-row-2",
          isOver && stories.length === 0 ? "se-lead-droptarget" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {stories.length === 0 ? (
          <button
            type="button"
            className="se-empty-slot"
            onClick={() => onCommit(addStory(content, row))}
          >
            Empty row — drop a story here or click to add one
          </button>
        ) : (
          stories.map((story, i) => (
            <StoryCard
              key={story.id}
              story={story}
              row={row}
              index={i}
              count={stories.length}
              content={content}
              onCommit={onCommit}
              variant={variant}
            />
          ))
        )}
      </div>
    </SortableContext>
  );
}

export default function HomeCanvas({ content, onCommit, onTransient }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const dragBaseRef = useRef<HomeContent | null>(null);
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    dragBaseRef.current = content;
    const [row, storyId] = id.split("|");
    if (row === "columnStories" || row === "footStories") {
      setActiveStory(content[row as StoryRow].find((s) => s.id === storyId) ?? null);
    }
  }

  function targetRowOf(overId: string): StoryRow | null {
    if (overId.startsWith("row:")) return overId.slice(4) as StoryRow;
    const [row] = overId.split("|");
    return row === "columnStories" || row === "footStories" ? (row as StoryRow) : null;
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const [, storyId] = activeId.split("|");
    if (!storyId || activeId.startsWith("classified|")) return;
    const fromRow = rowOf(content, storyId);
    const toRow = targetRowOf(String(over.id));
    if (!fromRow || !toRow || fromRow === toRow) return;
    const fromIndex = content[fromRow].findIndex((s) => s.id === storyId);
    const overId = String(over.id);
    const toIndex = overId.startsWith("row:")
      ? content[toRow].length
      : content[toRow].findIndex((s) => s.id === overId.split("|")[1]);
    onTransient(
      moveStoryAcross(content, fromRow, fromIndex, toRow, Math.max(0, toIndex)),
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const base = dragBaseRef.current ?? content;
    dragBaseRef.current = null;
    setActiveStory(null);
    const activeId = String(active.id);

    // Classified reorder (single container, indices stable during drag).
    if (activeId.startsWith("classified|")) {
      if (over && String(over.id).startsWith("classified|")) {
        const from = Number(activeId.split("|")[1]);
        const to = Number(String(over.id).split("|")[1]);
        if (from !== to) {
          onCommit(moveClassified(content, from, to), { base });
          return;
        }
      }
      onTransient(base);
      return;
    }

    const [, storyId] = activeId.split("|");
    if (!storyId) return;

    // Dropped onto the lead → swap with the lead story.
    if (over && String(over.id) === "lead-drop") {
      const rowInBase = rowOf(base, storyId);
      if (rowInBase) {
        onCommit(promoteToLead(base, rowInBase, storyId), { base });
        return;
      }
    }

    if (over) {
      const overId = String(over.id);
      const currentRow = rowOf(content, storyId);
      const overRow = targetRowOf(overId);
      if (currentRow && overRow === currentRow && !overId.startsWith("row:")) {
        const from = content[currentRow].findIndex((s) => s.id === storyId);
        const to = content[currentRow].findIndex(
          (s) => s.id === overId.split("|")[1],
        );
        if (from >= 0 && to >= 0 && from !== to) {
          onCommit(moveStory(content, currentRow, from, to), { base });
          return;
        }
      }
    }

    // Cross-row moves already happened via onDragOver transients — commit them.
    if (JSON.stringify(content) !== JSON.stringify(base)) {
      onCommit(content, { base });
    }
  }

  function handleDragCancel() {
    if (dragBaseRef.current) onTransient(dragBaseRef.current);
    dragBaseRef.current = null;
    setActiveStory(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={content.classifieds.map((_, i) => `classified|${i}`)}
        strategy={rectSortingStrategy}
      >
        <div className="sheet-classifieds sheet-classifieds--top">
          {content.classifieds.map((c, i) => (
            <ClassifiedBlock
              key={`${i}:${content.classifieds.length}`}
              classified={c}
              index={i}
              content={content}
              onCommit={onCommit}
            />
          ))}
          <button
            type="button"
            className="se-add-classified"
            title="Add a classified notice"
            onClick={() => onCommit(addClassified(content))}
          >
            +
          </button>
        </div>
      </SortableContext>

      <LeadCanvas content={content} onCommit={onCommit} />

      <StoryRowGrid row="columnStories" content={content} onCommit={onCommit} variant="column" />
      <StoryRowGrid row="footStories" content={content} onCommit={onCommit} variant="foot" />

      <div className="se-row-actions">
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommit(addStory(content, "columnStories"))}
        >
          + Add column story
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommit(addStory(content, "footStories"))}
        >
          + Add foot story
        </button>
      </div>

      <DragOverlay>
        {activeStory ? (
          <div className="se-drag-overlay">
            <div className="se-drag-overlay-headline">{activeStory.headline}</div>
            {activeStory.deck ? (
              <div className="se-drag-overlay-deck">{activeStory.deck}</div>
            ) : null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
