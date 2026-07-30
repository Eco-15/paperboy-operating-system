"use client";

// WYSIWYG canvas for the portfolio page: editable header + draggable holding
// cards with selection/duplicate/delete. Mirrors PortfolioGrid.tsx markup.

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PortfolioCard, PortfolioContent } from "@/lib/site-content/schema";
import {
  addCard,
  deleteCard,
  duplicateCard,
  moveCard,
  updateCard,
} from "@/lib/site-content/mutations";
import EditableText from "./EditableText";
import {
  BlockToolbar,
  EditableCut,
  ToolbarButton,
  useSelectable,
} from "./CanvasBits";

type Props = {
  content: PortfolioContent;
  onCommit: (next: PortfolioContent) => void;
};

function CardBlock({
  card,
  index,
  count,
  content,
  onCommit,
}: {
  card: PortfolioCard;
  index: number;
  count: number;
  content: PortfolioContent;
  onCommit: Props["onCommit"];
}) {
  const [editingHref, setEditingHref] = useState(false);
  const [href, setHref] = useState(card.href ?? "");
  const blockId = `card|${card.id}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  const { selected, selectProps } = useSelectable(blockId, {
    delete: () => onCommit(deleteCard(content, card.id)),
    duplicate: () => onCommit(duplicateCard(content, card.id)),
  });

  const patch = (p: Partial<PortfolioCard>) =>
    onCommit(updateCard(content, card.id, p));

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...selectProps}
      className={[
        "fp-article",
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
          label="◀"
          title="Move earlier"
          disabled={index === 0}
          onClick={() => onCommit(moveCard(content, index, index - 1))}
        />
        <ToolbarButton
          label="▶"
          title="Move later"
          disabled={index === count - 1}
          onClick={() => onCommit(moveCard(content, index, index + 1))}
        />
        <ToolbarButton
          label="⧉"
          title="Duplicate (⌘D)"
          onClick={() => onCommit(duplicateCard(content, card.id))}
        />
        <ToolbarButton
          label="🔗"
          title="Edit the brand's website link"
          onClick={() => {
            setHref(card.href ?? "");
            setEditingHref(true);
          }}
        />
        <ToolbarButton
          label="✕"
          title="Delete this brand (Del)"
          onClick={() => onCommit(deleteCard(content, card.id))}
        />
      </BlockToolbar>

      {editingHref ? (
        <div className="se-popover" onClick={(e) => e.stopPropagation()}>
          <label className="se-pop-field">
            <span>Brand website</span>
            <input
              className="tool-input"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <div className="se-pop-actions">
            <button type="button" className="tool-btn" onClick={() => setEditingHref(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="tool-btn tool-btn--solid"
              onClick={() => {
                patch({ href: href.trim() || undefined });
                setEditingHref(false);
              }}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      <h2 className="fp-headline">
        <EditableText value={card.brand} onCommit={(brand) => patch({ brand })} />
      </h2>
      <EditableCut
        cut={
          card.cutSrc
            ? {
                src: card.cutSrc,
                caption: card.cutCaption ?? `${card.brand} · ${card.tag}`,
                alt: card.cutAlt,
              }
            : undefined
        }
        onChange={(cut) =>
          patch(
            cut
              ? { cutSrc: cut.src, cutCaption: cut.caption, cutAlt: cut.alt }
              : { cutSrc: undefined, cutCaption: undefined, cutAlt: undefined },
          )
        }
      />
      <p className="fp-deck fp-deck--sm">
        <EditableText value={card.sector} onCommit={(sector) => patch({ sector })} />
      </p>
      <div className="fp-body">
        <EditableText
          as="p"
          rich
          value={card.thesis}
          onCommit={(thesis) => patch({ thesis })}
        />
      </div>
      {card.href ? (
        <div className="sheet-xref-row">
          <span className="sheet-xref">Visit {card.brand} →</span>
        </div>
      ) : null}
    </article>
  );
}

export default function PortfolioCanvas({ content, onCommit }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = content.cards.findIndex((c) => c.id === active.id);
    const to = content.cards.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    onCommit(moveCard(content, from, to));
  }

  return (
    <>
      <h1 className="fp-headline fp-headline--xl sheet-section-title">
        <EditableText
          value={content.title}
          onCommit={(title) => onCommit({ ...content, title })}
        />
      </h1>
      <p className="fp-deck">
        <EditableText
          rich
          value={content.deck}
          onCommit={(deck) => onCommit({ ...content, deck })}
        />
      </p>
      <div className="fp-byline">
        <EditableText
          value={content.byline}
          onCommit={(byline) => onCommit({ ...content, byline })}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={content.cards.map((c) => c.id)}
          strategy={rectSortingStrategy}
        >
          <div className="fp-row">
            {content.cards.length === 0 ? (
              <button
                type="button"
                className="se-empty-slot"
                onClick={() => onCommit(addCard(content))}
              >
                No holdings — click to add a brand
              </button>
            ) : (
              content.cards.map((card, i) => (
                <CardBlock
                  key={card.id}
                  card={card}
                  index={i}
                  count={content.cards.length}
                  content={content}
                  onCommit={onCommit}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="se-row-actions">
        <button type="button" className="tool-btn" onClick={() => onCommit(addCard(content))}>
          + Add brand
        </button>
      </div>
    </>
  );
}
