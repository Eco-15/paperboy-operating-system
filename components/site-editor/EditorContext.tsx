"use client";

// Selection plumbing for the canvases: which block is selected, and a
// registry mapping block ids to their delete/duplicate actions so the global
// Delete-key / Cmd+D handlers in SiteEditorApp can route to the right block.

import { createContext, useContext, useEffect } from "react";

export type BlockActions = {
  delete?: () => void;
  duplicate?: () => void;
};

export type EditorUi = {
  selectedId: string | null;
  select: (id: string | null) => void;
  registerBlock: (id: string, actions: BlockActions) => () => void;
};

export const EditorUiContext = createContext<EditorUi>({
  selectedId: null,
  select: () => {},
  registerBlock: () => () => {},
});

export function useEditorUi() {
  return useContext(EditorUiContext);
}

// Registers a block's keyboard actions for its lifetime.
export function useBlockActions(id: string, actions: BlockActions) {
  const { registerBlock } = useEditorUi();
  useEffect(() => registerBlock(id, actions));
}
