"use client";

import * as React from "react";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { usePortfolio } from "@/components/providers/portfolio-provider";
import { useQuotes } from "@/hooks/use-quotes";
import type { Quote } from "@/lib/types";

export function TickerMarquee() {
  const { watchlist, portfolio } = usePortfolio();
  const symbols = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...watchlist.map((w) => w.symbol),
          ...portfolio.positions.map((p) => p.symbol),
        ])
      ),
    [watchlist, portfolio.positions]
  );
  const { quotes } = useQuotes(symbols, 60_000);
  const list = React.useMemo(() => {
    const arr = symbols
      .map((s) => quotes[s])
      .filter((q): q is Quote => !!q);
    return arr.length ? arr : [];
  }, [symbols, quotes]);

  if (list.length === 0) {
    return (
      <div className="border-y border-ink/10 bg-paper-sub/70 backdrop-blur">
        <div className="container flex h-9 items-center gap-3 overflow-hidden text-xs text-ink-mute">
          <span className="eyebrow shrink-0 tracking-[0.3em]">LIVE TAPE</span>
          <span className="font-mono">Awaiting quotes…</span>
        </div>
      </div>
    );
  }

  const doubled = [...list, ...list];

  return (
    <div className="sticky top-14 z-20 border-y border-ink/10 bg-paper-sub/70 backdrop-blur">
      <div className="container flex h-9 items-center gap-4 overflow-hidden">
        <span className="eyebrow shrink-0 tracking-[0.3em] text-ink-mute">
          LIVE TAPE
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="ticker-move flex min-w-max items-center gap-8 will-change-transform">
            {doubled.map((q, i) => (
              <TickerItem key={`${q.symbol}-${i}`} quote={q} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-paper-sub to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper-sub to-transparent" />
        </div>
      </div>
    </div>
  );
}

function TickerItem({ quote }: { quote: Quote }) {
  const up = quote.changePct >= 0;
  const isFx = quote.assetClass === "fx";
  return (
    <span className="flex items-baseline gap-1.5 text-[11px]">
      <span className="font-mono font-medium tracking-wide text-ink">
        {quote.symbol}
      </span>
      <span className="num text-ink">
        {formatNumber(quote.price, isFx ? 4 : 2)}
      </span>
      {!isFx && (
        <span
          className={cn(
            "num",
            up ? "text-signal-up" : "text-signal-down"
          )}
        >
          {formatPercent(quote.changePct)}
        </span>
      )}
      <span className="mx-2 h-3 w-px bg-ink/15" aria-hidden />
    </span>
  );
}
