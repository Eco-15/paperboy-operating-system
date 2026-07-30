"use client";

// Transient in-app feedback ("Saved", "Couldn't sync", …). A tiny module-level
// event bus so ANY client component can fire a toast without prop-drilling or a
// context: ToastHost (mounted once in the shell) subscribes and renders them.
//
// Distinct from the notification *feed* (the bell): toasts are ephemeral and
// client-only; feed items are persisted rows created server-side (lib/notify/create).

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(toasts);
  return () => listeners.delete(l);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Show a toast. Returns its id so it can be dismissed early. */
export function toast(
  message: string,
  opts: { type?: ToastType; duration?: number } = {},
): number {
  const id = nextId++;
  const duration = opts.duration ?? (opts.type === "error" ? 6000 : 4000);
  toasts = [...toasts, { id, message, type: opts.type ?? "info", duration }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
  return id;
}
