"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Quote } from "@/lib/types";

const DEFAULT_INTERVAL_MS = 60_000;

interface UseQuotesResult {
  quotes: Record<string, Quote>;
  loading: boolean;
  lastFetched: string | null;
  error: string | null;
  refresh: () => void;
}

export function useQuotes(
  symbols: string[],
  intervalMs: number = DEFAULT_INTERVAL_MS
): UseQuotesResult {
  const [quotes, setQuotes] = React.useState<Record<string, Quote>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastFetched, setLastFetched] = React.useState<string | null>(null);

  const symbolsKey = React.useMemo(() => {
    return Array.from(new Set(symbols.map((s) => s.trim()).filter(Boolean)))
      .sort()
      .join(",");
  }, [symbols]);

  const fetchQuotes = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!symbolsKey) {
        setQuotes({});
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/quotes?symbols=${encodeURIComponent(symbolsKey)}`,
          { signal }
        );
        const json = await res.json();
        if (!res.ok) {
          const msg = json?.error ?? "Failed to fetch quotes";
          setError(msg);
          if (res.status === 429) {
            toast.warning("Market data rate limit", {
              description: msg,
              id: "quotes-rate-limit",
            });
          }
          return;
        }
        const list: Quote[] = json.quotes ?? [];
        const next: Record<string, Quote> = {};
        for (const q of list) next[q.symbol] = q;
        setQuotes((prev) => ({ ...prev, ...next }));
        setLastFetched(new Date().toISOString());
        setError(null);
        // If we're on the demo-data path, show a soft, one-time info toast
        // rather than the noisy warning — every subsequent refresh is a noop
        // thanks to the shared id.
        if (list.some((q) => q.source === "demo")) {
          toast.info("Showing demo data", {
            description:
              "Live providers are temporarily unavailable. Prices on screen are representative, not live.",
            id: "quotes-demo-data",
            duration: 6000,
          });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [symbolsKey]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    fetchQuotes(controller.signal);
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchQuotes();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchQuotes();
    }, intervalMs);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchQuotes, intervalMs]);

  return {
    quotes,
    loading,
    lastFetched,
    error,
    refresh: () => fetchQuotes(),
  };
}
