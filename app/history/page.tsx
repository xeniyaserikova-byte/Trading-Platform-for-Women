"use client";

import * as React from "react";
import { usePortfolio } from "@/components/providers/portfolio-provider";
import { PageHeader } from "@/components/page-header";
import { AssetChip } from "@/components/quote-cell";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export default function HistoryPage() {
  const { trades, hydrated } = usePortfolio();

  const buys = trades.filter((t) => t.side === "buy").length;
  const sells = trades.length - buys;
  const volume = trades.reduce((s, t) => s + t.notional, 0);

  return (
    <div>
      <PageHeader
        eyebrow="The Ledger"
        title={
          <>
            Every decision,
            <br />
            <span className="italic text-salmon">dated</span> and filed.
          </>
        }
        lede="A chronological record is the simplest mirror a trader has. Scroll slowly, and notice what hurries you."
      />

      <div className="mb-10 grid grid-cols-3 gap-px bg-ink/10">
        <Kpi label="Total trades" value={trades.length.toString()} />
        <Kpi label="Buys · Sells" value={`${buys} · ${sells}`} />
        <Kpi label="Cumulative notional" value={formatCurrency(volume)} />
      </div>

      {!hydrated ? (
        <div className="h-40 animate-pulse bg-ink/5" />
      ) : trades.length === 0 ? (
        <div className="border border-dashed border-ink/20 px-10 py-24 text-center">
          <p className="mx-auto max-w-md font-display text-2xl italic text-ink-soft">
            The ledger is still in its first blank page.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          <div className="grid grid-cols-12 items-end py-3 text-xs">
            <div className="col-span-3 eyebrow">When</div>
            <div className="col-span-3 eyebrow">Instrument</div>
            <div className="col-span-1 eyebrow">Side</div>
            <div className="col-span-2 eyebrow text-right">Qty × Price</div>
            <div className="col-span-3 eyebrow text-right">Notional</div>
          </div>
          {trades.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-12 items-center py-4 transition-colors hover:bg-paper-sub/50"
            >
              <div className="col-span-3">
                <div className="font-mono text-xs text-ink">
                  {new Date(t.timestamp).toLocaleDateString(undefined, {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  })}
                </div>
                <div className="font-mono text-[11px] text-ink-mute">
                  {new Date(t.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className="col-span-3 flex items-center gap-3">
                <div className="font-display text-xl font-medium leading-none">
                  {t.symbol}
                </div>
                <AssetChip assetClass={t.assetClass} />
              </div>
              <div className="col-span-1">
                <span
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 text-[10px] uppercase tracking-[0.22em]",
                    t.side === "buy"
                      ? "bg-signal-up/15 text-signal-up"
                      : "bg-signal-down/15 text-signal-down"
                  )}
                >
                  {t.side}
                </span>
              </div>
              <div className="col-span-2 text-right">
                <span className="num text-sm">
                  {formatNumber(t.qty, 4)} × {formatNumber(t.price, 4)}
                </span>
              </div>
              <div className="col-span-3 text-right">
                <span className="num text-[15px] font-medium">
                  {formatCurrency(t.notional)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-6">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-3xl font-medium tracking-tight">
        {value}
      </div>
    </div>
  );
}
