"use client";

import * as React from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/components/providers/portfolio-provider";
import type { Instrument } from "@/lib/types";
import { parseSymbol } from "@/lib/market-data/types";

export function AddSymbolDialog() {
  const { watchlist, addWatchlist } = usePortfolio();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Instrument[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error ?? "Search failed");
          setResults([]);
          return;
        }
        setResults(json.results ?? []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const isOnWatchlist = (symbol: string) =>
    watchlist.some((w) => w.symbol === symbol);

  const addDirect = () => {
    const parsed = parseSymbol(query);
    if (!parsed.symbol) return;
    if (isOnWatchlist(parsed.symbol)) {
      toast.info("Already on watchlist");
      return;
    }
    addWatchlist({
      symbol: parsed.symbol,
      assetClass: parsed.assetClass,
    });
    toast.success(`Added ${parsed.symbol}`);
    setOpen(false);
  };

  const add = (item: Instrument) => {
    if (isOnWatchlist(item.symbol)) {
      toast.info("Already on watchlist");
      return;
    }
    addWatchlist({
      symbol: item.symbol,
      assetClass: item.assetClass,
      name: item.name,
    });
    toast.success(`Added ${item.symbol}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-xs uppercase tracking-[0.22em] text-paper transition-transform hover:-translate-y-px"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </DialogTrigger>
      <DialogContent className="gap-0 border-ink/15 bg-paper p-0">
        <DialogHeader className="border-b border-ink/10 px-8 py-6">
          <div className="eyebrow mb-2">New instrument</div>
          <DialogTitle className="font-display text-3xl font-semibold leading-none tracking-tight">
            Add to the watch.
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-ink-soft">
            Search by ticker or company, or type an FX pair like
            &quot;EUR/USD&quot; and press Enter.
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 py-5">
          <div className="relative">
            <Search className="absolute left-0 top-3.5 h-4 w-4 text-ink-mute" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) addDirect();
              }}
              placeholder="AAPL · Tesla · EUR/USD"
              className="h-12 rounded-none border-0 border-b border-ink/30 bg-transparent pl-6 text-xl font-display shadow-none focus-visible:ring-0 focus-visible:border-salmon"
            />
          </div>
        </div>

        <div className="max-h-[320px] space-y-1 overflow-y-auto px-5 pb-5">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-ink-mute">
              <Loader2 className="h-4 w-4 animate-spin text-salmon" />
              Searching the register…
            </div>
          )}
          {!loading && error && (
            <div className="px-3 py-2 text-sm text-signal-down">{error}</div>
          )}
          {!loading && !error && results.length === 0 && query.trim() && (
            <div className="px-3 py-2 text-sm text-ink-mute">
              No matches. Press <span className="italic">Enter</span> to add{" "}
              <span className="font-mono text-ink">
                {query.trim().toUpperCase()}
              </span>{" "}
              directly.
            </div>
          )}
          {results.map((item) => {
            const already = isOnWatchlist(item.symbol);
            return (
              <button
                key={item.symbol}
                type="button"
                disabled={already}
                onClick={() => add(item)}
                className="group flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-paper-sub disabled:opacity-40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-medium">
                      {item.symbol}
                    </span>
                    {item.region && (
                      <span className="inline-flex items-center border-hairline border-ink/20 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.22em] text-ink-mute">
                        {item.region}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {item.name}
                  </div>
                </div>
                <span className="text-xs uppercase tracking-[0.22em] text-salmon opacity-0 transition-opacity group-hover:opacity-100">
                  {already ? "added" : "add"}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
