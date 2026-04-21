"use client";

import * as React from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, Trash2, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/components/providers/portfolio-provider";
import { useQuotes } from "@/hooks/use-quotes";
import {
  AssetChip,
  ChangeText,
  PriceText,
  StaleChip,
} from "@/components/quote-cell";
import { AddSymbolDialog } from "@/components/add-symbol-dialog";
import { TradeDialog } from "@/components/trade-dialog";
import { MarketSummary } from "@/components/market-summary";
import { PageHeader } from "@/components/page-header";
import { useSound } from "@/components/providers/sound-provider";
import { formatNumber, formatRelativeTime } from "@/lib/utils";
import type { TradeSide } from "@/lib/types";

export default function WatchlistPage() {
  const { watchlist, removeWatchlist, hydrated } = usePortfolio();
  const { play } = useSound();
  const symbols = React.useMemo(
    () => watchlist.map((w) => w.symbol),
    [watchlist]
  );
  const { quotes, loading, lastFetched, refresh, error } = useQuotes(symbols);

  const [tradeState, setTradeState] = React.useState<{
    open: boolean;
    symbol: string;
    side: TradeSide;
  }>({ open: false, symbol: "", side: "buy" });

  return (
    <div>
      <PageHeader
        eyebrow="Lipstick & Ledger · The morning edit"
        title={
          <>
            Markets, in{" "}
            <span className="italic text-rose">your color.</span>
          </>
        }
        lede={
          <>
            A confident, rosé-tinted desk for the women rewriting who gets to
            call themselves a trader. Press{" "}
            <span className="italic">trade</span> to commit virtual capital, or
            let{" "}
            <Link
              href="/wavick"
              className="italic text-rose hover:text-rose-deep"
            >
              Wavick
            </Link>{" "}
            interview you and build a plan.
          </>
        }
        right={
          <div className="flex items-center gap-3">
            {lastFetched && (
              <div className="text-right leading-tight">
                <div className="eyebrow">Last tape</div>
                <div className="font-mono text-xs text-ink-mute">
                  {formatRelativeTime(lastFetched)}
                </div>
              </div>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={refresh}
              aria-label="Refresh tape"
              disabled={loading}
              className="text-ink-mute hover:text-ink"
            >
              <RefreshCw
                className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
            </Button>
            <AddSymbolDialog />
          </div>
        }
      />

      <MarketSummary />

      <div className="mb-6 flex items-end justify-between gap-4 border-t border-ink/10 pt-10">
        <div>
          <div className="eyebrow">Your desk · Watchlist</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
            Personal tape
          </h2>
        </div>
      </div>

      {!hydrated ? (
        <TableSkeleton />
      ) : watchlist.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {/* column header */}
          <div className="grid grid-cols-12 items-end py-3 text-xs">
            <div className="col-span-4 eyebrow">Instrument</div>
            <div className="col-span-2 eyebrow text-right">Last</div>
            <div className="col-span-2 eyebrow text-right">Δ Today</div>
            <div className="col-span-1 eyebrow">Class</div>
            <div className="col-span-3 eyebrow text-right">Action</div>
          </div>

          {watchlist.map((item, i) => {
            const q = quotes[item.symbol];
            return (
              <div
                key={item.symbol}
                className="group grid grid-cols-12 items-center py-5 transition-colors hover:bg-paper-sub/50"
              >
                <div className="col-span-4 flex items-center gap-4">
                  <div className="font-mono text-sm text-ink-mute">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="font-display text-2xl font-medium leading-none tracking-tight text-ink">
                      {item.symbol}
                    </div>
                    <div className="mt-1 text-[13px] text-ink-soft">
                      {item.name ??
                        (item.assetClass === "fx"
                          ? "FX Pair"
                          : "Equity")}
                    </div>
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  {q ? (
                    <PriceText quote={q} />
                  ) : loading ? (
                    <span className="num text-ink-mute">…</span>
                  ) : (
                    <span className="text-ink-mute">—</span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <ChangeText quote={q} />
                </div>
                <div className="col-span-1 flex items-center gap-1.5">
                  <AssetChip assetClass={item.assetClass} />
                  <StaleChip quote={q} />
                </div>
                <div className="col-span-3 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={!q}
                    onMouseEnter={() => q && play("tick")}
                    onClick={() => {
                      play("pop");
                      setTradeState({
                        open: true,
                        symbol: item.symbol,
                        side: "buy",
                      });
                    }}
                    className="inline-flex h-8 items-center gap-1.5 border-hairline border-ink/30 bg-paper px-3 text-xs font-medium tracking-wide text-ink transition-colors hover:border-rose hover:bg-rose hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" /> Trade
                  </button>
                  <Link
                    href={`/wavick?about=${encodeURIComponent(item.symbol)}`}
                    className="inline-flex h-8 items-center gap-1.5 border-hairline border-transparent px-3 text-xs text-ink-mute transition-colors hover:border-ink/20 hover:text-ink"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Ask Wavick
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeWatchlist(item.symbol)}
                    aria-label={`Remove ${item.symbol}`}
                    className="text-ink-mute opacity-0 transition-opacity hover:text-signal-down group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-4 font-mono text-xs text-ink-mute">
          Tape disruption: {error}
        </p>
      )}

      <FootNote />

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

function TableSkeleton() {
  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 items-center py-5">
          <div className="col-span-4 h-6 w-40 animate-pulse bg-ink/5" />
          <div className="col-span-2 ml-auto h-4 w-20 animate-pulse bg-ink/5" />
          <div className="col-span-2 ml-auto h-4 w-16 animate-pulse bg-ink/5" />
          <div className="col-span-1 h-4 w-10 animate-pulse bg-ink/5" />
          <div className="col-span-3 ml-auto h-7 w-40 animate-pulse bg-ink/5" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-ink/20 px-10 py-24 text-center">
      <div className="eyebrow mb-3">A blank tape</div>
      <p className="mx-auto max-w-md font-display text-2xl italic text-ink-soft">
        Your watchlist awaits its first instrument.
      </p>
    </div>
  );
}

function FootNote() {
  return (
    <div className="mt-10 grid gap-6 border-t border-ink/10 pt-8 md:grid-cols-3">
      <Link
        href="/portfolio"
        className="group border-l border-ink/10 px-4"
      >
        <div className="eyebrow mb-2">The Book</div>
        <div className="font-display text-xl font-medium text-ink group-hover:text-salmon">
          Review your positions →
        </div>
        <p className="mt-1 text-sm text-ink-mute">
          Mark-to-market, unrealized P&amp;L, and cash at rest.
        </p>
      </Link>
      <Link href="/history" className="group border-l border-ink/10 px-4">
        <div className="eyebrow mb-2">The Ledger</div>
        <div className="font-display text-xl font-medium text-ink group-hover:text-salmon">
          Every trade, dated →
        </div>
        <p className="mt-1 text-sm text-ink-mute">
          A complete chronological log of decisions.
        </p>
      </Link>
      <Link
        href="/wavick"
        className="group border-l border-rose/60 bg-rose/10 px-4 py-1"
      >
        <div className="eyebrow mb-2">Wavick</div>
        <div className="font-display text-xl font-medium italic text-ink group-hover:text-rose-deep">
          Let an AI plan with you →
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          A short interview, then a plan. Every trade needs your approval.
        </p>
      </Link>
    </div>
  );
}
