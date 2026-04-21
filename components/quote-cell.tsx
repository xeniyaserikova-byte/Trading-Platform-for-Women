"use client";

import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { Quote } from "@/lib/types";

export function PriceText({ quote }: { quote: Quote | undefined }) {
  if (!quote) return <span className="text-ink-mute">—</span>;
  const price =
    quote.assetClass === "fx"
      ? formatNumber(quote.price, 4)
      : formatCurrency(quote.price, quote.currency);
  return <span className="num text-[15px] font-medium text-ink">{price}</span>;
}

export function ChangeText({ quote }: { quote: Quote | undefined }) {
  if (!quote) return <span className="text-ink-mute">—</span>;
  if (quote.assetClass === "fx") {
    return <span className="text-ink-mute">—</span>;
  }
  const up = quote.changePct >= 0;
  return (
    <span
      className={cn(
        "num text-sm font-medium",
        up ? "text-signal-up" : "text-signal-down"
      )}
    >
      {formatPercent(quote.changePct)}
    </span>
  );
}

export function StaleChip({ quote }: { quote: Quote | undefined }) {
  if (!quote) return null;
  if (!quote.stale) return null;
  return (
    <span className="inline-flex items-center gap-1.5 border-hairline border-ink/30 bg-paper-sub px-1.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-ink-mute">
      <span className="h-1 w-1 rounded-full bg-salmon animate-pulse" />
      {quote.note ? "stale" : "stale"}
    </span>
  );
}

export function AssetChip({ assetClass }: { assetClass: "stock" | "fx" }) {
  return (
    <span className="inline-flex items-center border-hairline border-ink/20 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.22em] text-ink-mute">
      {assetClass}
    </span>
  );
}
