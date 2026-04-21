"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/providers/portfolio-provider";
import { useQuotes } from "@/hooks/use-quotes";
import { TradeDialog } from "@/components/trade-dialog";
import { PageHeader } from "@/components/page-header";
import { AssetChip } from "@/components/quote-cell";
import {
  cn,
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import { portfolioSnapshot } from "@/lib/trading/execute";
import type { TradeSide } from "@/lib/types";

export default function PortfolioPage() {
  const { portfolio, hydrated, resetAll } = usePortfolio();
  const symbols = React.useMemo(
    () => portfolio.positions.map((p) => p.symbol),
    [portfolio.positions]
  );
  const { quotes, loading } = useQuotes(symbols);
  const snap = portfolioSnapshot(portfolio, quotes);
  const pnlUp = snap.unrealizedPnL >= 0;

  const [tradeState, setTradeState] = React.useState<{
    open: boolean;
    symbol: string;
    side: TradeSide;
  }>({ open: false, symbol: "", side: "sell" });

  return (
    <div>
      <PageHeader
        eyebrow="The Book"
        title={
          <>
            An account <span className="italic text-salmon">at</span> rest,
            <br />
            an account <span className="italic">at work.</span>
          </>
        }
        lede="Your ledger balances re-read the tape every half-minute. Cash sits patient; positions are marked against the latest print."
        right={
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Reset portfolio and trade history? This resets cash to $100,000."
                )
              ) {
                resetAll();
                toast.success("Account reset");
              }
            }}
            className="inline-flex h-9 items-center gap-1.5 border-hairline border-ink/30 px-3 text-xs text-ink-mute transition-colors hover:border-ink hover:text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset account
          </button>
        }
      />

      {/* Editorial pull-quote equity card */}
      <section className="mb-12 grid gap-6 md:grid-cols-12">
        <div className="md:col-span-7">
          <div className="eyebrow mb-4">Total equity</div>
          <div className="font-display text-7xl font-semibold leading-none tracking-tight text-ink md:text-[8.5rem]">
            {formatCurrency(snap.totalEquity, portfolio.baseCurrency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-4 flex items-baseline gap-4 font-mono text-xs">
            <span
              className={cn(
                "num inline-flex items-center gap-1 px-1.5 py-0.5",
                pnlUp
                  ? "bg-signal-up/15 text-signal-up"
                  : "bg-signal-down/15 text-signal-down"
              )}
            >
              {pnlUp ? "▲" : "▼"} {formatCurrency(Math.abs(snap.unrealizedPnL))}{" "}
              unrealized
            </span>
            <span className="text-ink-mute">
              {portfolio.positions.length} position
              {portfolio.positions.length === 1 ? "" : "s"} · {portfolio.baseCurrency}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-ink/10 md:col-span-5">
          <StatBlock label="Cash at rest" value={formatCurrency(snap.cash)} />
          <StatBlock
            label="Positions value"
            value={formatCurrency(snap.positionsValue)}
          />
          <StatBlock
            label="Starting capital"
            value={formatCurrency(100_000)}
            mute
          />
          <StatBlock
            label="Return vs. start"
            value={formatPercent(
              ((snap.totalEquity - 100_000) / 100_000) * 100
            )}
            tone={snap.totalEquity >= 100_000 ? "up" : "down"}
          />
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between">
        <div className="eyebrow">Positions</div>
        <div className="eyebrow text-ink-mute">
          Marked {loading ? "…" : "live"}
        </div>
      </div>

      {!hydrated ? (
        <div className="h-32 animate-pulse bg-ink/5" />
      ) : portfolio.positions.length === 0 ? (
        <div className="border border-dashed border-ink/20 px-10 py-20 text-center">
          <p className="mx-auto max-w-md font-display text-2xl italic text-ink-soft">
            No positions yet. Every portfolio starts with a single trade.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          <div className="grid grid-cols-12 items-end py-3 text-xs">
            <div className="col-span-4 eyebrow">Instrument</div>
            <div className="col-span-1 eyebrow text-right">Qty</div>
            <div className="col-span-2 eyebrow text-right">Avg cost</div>
            <div className="col-span-2 eyebrow text-right">Mkt value</div>
            <div className="col-span-1 eyebrow text-right">P&amp;L</div>
            <div className="col-span-2 eyebrow text-right">Action</div>
          </div>
          {portfolio.positions.map((p, i) => {
            const q = quotes[p.symbol];
            const mktValue = q ? q.price * p.qty : p.avgCost * p.qty;
            const pnl = q ? (q.price - p.avgCost) * p.qty : 0;
            const pnlPct =
              q && p.avgCost > 0
                ? ((q.price - p.avgCost) / p.avgCost) * 100
                : 0;
            const up = pnl >= 0;
            return (
              <div
                key={p.symbol}
                className="group grid grid-cols-12 items-center py-5 transition-colors hover:bg-paper-sub/50"
              >
                <div className="col-span-4 flex items-center gap-4">
                  <div className="font-mono text-sm text-ink-mute">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="font-display text-2xl font-medium leading-none tracking-tight">
                      {p.symbol}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <AssetChip assetClass={p.assetClass} />
                      {q?.stale && (
                        <span className="text-[10px] uppercase tracking-[0.22em] text-salmon">
                          stale
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-span-1 text-right">
                  <span className="num text-sm">
                    {formatNumber(p.qty, 4)}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="num text-sm text-ink-soft">
                    {formatNumber(p.avgCost, 4)}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="num text-[15px] font-medium">
                    {formatCurrency(mktValue)}
                  </span>
                  {q && (
                    <div className="num text-[11px] text-ink-mute">
                      @ {formatNumber(q.price, 4)}
                    </div>
                  )}
                </div>
                <div className="col-span-1 text-right">
                  {q ? (
                    <div className="flex flex-col items-end leading-tight">
                      <span
                        className={cn(
                          "num text-sm font-medium",
                          up ? "text-signal-up" : "text-signal-down"
                        )}
                      >
                        {up ? "+" : ""}
                        {formatCurrency(pnl)}
                      </span>
                      <span
                        className={cn(
                          "num text-[11px]",
                          up ? "text-signal-up/80" : "text-signal-down/80"
                        )}
                      >
                        {formatPercent(pnlPct)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-ink-mute">—</span>
                  )}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={!q}
                    onClick={() =>
                      setTradeState({
                        open: true,
                        symbol: p.symbol,
                        side: "sell",
                      })
                    }
                    className="inline-flex h-8 items-center gap-1.5 border-hairline border-ink/30 bg-paper px-3 text-xs font-medium text-ink transition-colors hover:border-salmon hover:bg-salmon disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" /> Trade
                  </button>
                  <Link
                    href={`/wavick?about=${encodeURIComponent(p.symbol)}`}
                    className="inline-flex h-8 items-center gap-1.5 border-hairline border-transparent px-3 text-xs text-ink-mute transition-colors hover:border-ink/20 hover:text-ink"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Wavick
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TradeDialog
        open={tradeState.open}
        onOpenChange={(open) => setTradeState((s) => ({ ...s, open }))}
        quote={quotes[tradeState.symbol]}
        symbol={tradeState.symbol}
        defaultSide={tradeState.side}
      />
    </div>
  );
}

function StatBlock({
  label,
  value,
  tone,
  mute,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  mute?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between bg-paper p-5">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          "num mt-3 text-xl font-medium",
          mute && "text-ink-mute",
          tone === "up" && "text-signal-up",
          tone === "down" && "text-signal-down"
        )}
      >
        {value}
      </div>
    </div>
  );
}
