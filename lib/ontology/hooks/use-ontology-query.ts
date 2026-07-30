"use client";

import { useState, useEffect, useCallback } from "react";
import type { QueryResult } from "../types";

interface UseOntologyQueryOpts {
  filters?: Record<string, string>;
  sort?: string;
  limit?: number;
  offset?: number;
  /** Set false to disable auto-fetch on mount */
  enabled?: boolean;
}

interface UseOntologyQueryResult {
  data: QueryResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useOntologyQuery(
  objectType: string,
  opts: UseOntologyQueryOpts = {},
): UseOntologyQueryResult {
  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { filters = {}, sort, limit = 50, offset = 0, enabled = true } = opts;

  // Stable key for dependency tracking
  const filterKey = JSON.stringify(filters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      params.set(`filter[${k}]`, v);
    }
    if (sort) params.set("sort", sort);
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    try {
      const res = await fetch(`/api/ontology/${objectType}?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || res.statusText);
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectType, filterKey, sort, limit, offset]);

  useEffect(() => {
    if (enabled) fetchData();
  }, [enabled, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
