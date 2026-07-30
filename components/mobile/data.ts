"use client";

// Client data layer for the mobile shell: payload types that mirror the API
// contracts exactly, plus one small stale-while-revalidate fetch hook. No
// caching library — refresh keeps old data on screen so the UI never blanks,
// and errors keep whatever was last loaded.
//
// The phone app is the Investment CRM and nothing else, so /api/crm is the only
// contract here.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Deal } from "@/lib/crm/types";

/* ── Payload shapes (per the API contracts) ─────────────────────── */

/** ?lite=1 drops the long-text fields; the deal sheet refetches them in full. */
export type LiteDeal = Omit<Deal, "message" | "onePager">;

export type CrmPayload = {
  deals: LiteDeal[];
  newCount: number;
  archivedCount: number;
  /** This user's watermark — what "new" is measured against. */
  newSince: string | null;
  /** Inbound deal ids that landed after it, newest first. */
  newIds: string[];
};

/* ── Fetch hook ─────────────────────────────────────────────────── */

export type Remote<T> = {
  status: "loading" | "error" | "ok";
  data: T | null;
  /** HTTP status on error (null = network failure). */
  code: number | null;
};

export type RemoteHandle<T> = {
  state: Remote<T>;
  reload: () => Promise<void>;
  mutate: (fn: (data: T) => T) => void;
};

export function useRemote<T>(url: string): RemoteHandle<T> {
  const [state, setState] = useState<Remote<T>>({
    status: "loading",
    data: null,
    code: null,
  });

  const load = useCallback(async () => {
    // Only show the skeleton on the very first load — reloads keep stale data.
    setState((s) => (s.data === null ? { status: "loading", data: null, code: null } : s));
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const code = res.status;
        setState((s) => ({ status: "error", data: s.data, code }));
        return;
      }
      const json = (await res.json()) as T;
      setState({ status: "ok", data: json, code: null });
    } catch {
      setState((s) => ({ status: "error", data: s.data, code: null }));
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = useCallback((fn: (data: T) => T) => {
    setState((s) => (s.data === null ? s : { ...s, data: fn(s.data) }));
  }, []);

  return { state, reload: load, mutate };
}

export function errorLabel(code: number | null): string {
  if (code === 401 || code === 403) return "Sign in as staff to see this.";
  return "Couldn't load — check your connection.";
}

/**
 * Keeps the last non-null value so a closing sheet can still render its
 * content during the exit animation.
 */
export function useLatched<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  if (value !== null) ref.current = value;
  return value !== null ? value : ref.current;
}
