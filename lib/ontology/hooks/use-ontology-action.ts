"use client";

import { useState, useCallback } from "react";
import type { ActionResult } from "../types";

interface UseOntologyActionResult {
  execute: (params: Record<string, unknown>) => Promise<ActionResult>;
  loading: boolean;
  error: string | null;
  result: ActionResult | null;
}

export function useOntologyAction(actionName: string): UseOntologyActionResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  const execute = useCallback(
    async (params: Record<string, unknown>): Promise<ActionResult> => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch(`/api/ontology/actions/${actionName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await res.json();

        if (!res.ok) {
          const actionResult: ActionResult = { ok: false, error: data.error || res.statusText };
          setError(actionResult.error!);
          setResult(actionResult);
          return actionResult;
        }

        setResult(data);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        const actionResult: ActionResult = { ok: false, error: msg };
        setError(msg);
        setResult(actionResult);
        return actionResult;
      } finally {
        setLoading(false);
      }
    },
    [actionName],
  );

  return { execute, loading, error, result };
}
