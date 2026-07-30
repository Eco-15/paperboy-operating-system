"use client";

import ObjectTable from "./ObjectTable";

// The side panel for DATA results (a deal table, a stats blob). Documents live in
// ArtifactPanel — they're editable, versioned, and stream in as they're written.
export interface CanvasContent {
  title: string;
  objectType?: string;
  objects?: Record<string, unknown>[];
  json?: unknown;
}

export default function Canvas({
  content,
  onClose,
}: {
  content: CanvasContent;
  onClose: () => void;
}) {
  return (
    <aside className="chat-canvas">
      <div className="chat-canvas-head">
        <span className="chat-canvas-title">{content.title}</span>
        <button type="button" className="chat-canvas-close" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>
      <div className="chat-canvas-body">
        {content.objectType && content.objects ? (
          <ObjectTable objectType={content.objectType} objects={content.objects} />
        ) : (
          <pre className="chat-step-json">{JSON.stringify(content.json, null, 2)}</pre>
        )}
      </div>
    </aside>
  );
}
