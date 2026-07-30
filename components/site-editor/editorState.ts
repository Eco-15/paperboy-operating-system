// Pure document reducer for the Site Editor: present draft + undo/redo
// stacks. `revision` keys the canvas — it bumps whenever content changes out
// from under the uncontrolled contentEditables (load/undo/redo) and stays put
// on ordinary commits (the DOM already matches what was committed).

export type DocState<C> = {
  present: C | null;
  past: C[]; // oldest → newest
  future: C[]; // newest-first
  revision: number;
};

export type DocAction<C> =
  | { type: "load"; content: C } // page switch / 409 reload / revert / restore
  | { type: "commit"; next: C; base?: C } // normal edit (base = pre-drag snapshot)
  | { type: "transient"; next: C } // mid-drag preview: no history entry
  | { type: "undo" }
  | { type: "redo" };

const UNDO_CAP = 100;

export function initialDocState<C>(): DocState<C> {
  return { present: null, past: [], future: [], revision: 0 };
}

export function docReducer<C>(state: DocState<C>, action: DocAction<C>): DocState<C> {
  switch (action.type) {
    case "load":
      return {
        present: action.content,
        past: [],
        future: [],
        revision: state.revision + 1,
      };
    case "commit": {
      if (state.present === null) return state;
      const base = action.base ?? state.present;
      return {
        present: action.next,
        past: [...state.past, base].slice(-UNDO_CAP),
        future: [],
        revision: state.revision,
      };
    }
    case "transient":
      if (state.present === null) return state;
      return { ...state, present: action.next };
    case "undo": {
      if (state.past.length === 0 || state.present === null) return state;
      const past = [...state.past];
      const previous = past.pop()!;
      return {
        present: previous,
        past,
        future: [state.present, ...state.future],
        revision: state.revision + 1,
      };
    }
    case "redo": {
      if (state.future.length === 0 || state.present === null) return state;
      const [next, ...future] = state.future;
      return {
        present: next,
        past: [...state.past, state.present].slice(-UNDO_CAP),
        future,
        revision: state.revision + 1,
      };
    }
  }
}
