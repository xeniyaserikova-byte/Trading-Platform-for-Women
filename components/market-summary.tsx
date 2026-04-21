"use client";

import * as React from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Sparkline } from "@/components/sparkline";
import { cn, formatNumber, formatPercent, formatRelativeTime } from "@/lib/utils";
import type { Quote } from "@/lib/types";

interface SummaryQuote {
  symbol: string;
  quote?: Quote;
  error?: string;
}

interface MarketSummaryPayload {
  hero: {
    symbol: string;
    name: string;
    badge: string;
    quote?: Quote;
    quoteError?: string;
    history?: {
      symbol: string;
      points: { date: string; close: number }[];
      source: string;
      stale: boolean;
    };
    historyError?: string;
  };
  indices: SummaryQuote[];
  cards: Array<{
    id: string;
    title: string;
    eyebrow: string;
    items: SummaryQuote[];
  }>;
  generatedAt: string;
  usingDemoData: boolean;
}

const REFRESH_INTERVAL_MS = 60_000;

export function MarketSummary() {
  const [data, setData] = React.useState<MarketSummaryPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/markets/summary", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      setData(json as MarketSummaryPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="mb-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Market Summary · Today's edit</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            The tape, <span className="italic text-rose">in rosé.</span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {data?.generatedAt && (
            <div className="text-right leading-tight">
              <div className="eyebrow">Updated</div>
              <div className="num text-xs text-ink-mute">
                {formatRelativeTime(data.generatedAt)}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh summary"
            className="inline-flex h-8 w-8 items-center justify-center border-hairline border-ink/20 text-ink-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </button>
        </div>
      </div>

      {error && !data && <SummarySkeleton error={error} />}
      {!data && loading && <SummarySkeleton />}

      {data && (
        <>
          {data.usingDemoData && <DemoBanner />}
          <div className="grid gap-8 lg:grid-cols-12">
            <HeroCard hero={data.hero} />
            <IndicesRail items={data.indices} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {data.cards.map((card) => (
              <SummaryCard key={card.id} card={card} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DemoBanner() {
  return (
    <div className="mb-6 flex items-start gap-4 rounded-md border-l-2 border-rose bg-rose/10 px-5 py-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-rose" />
      <div className="flex-1">
        <div className="eyebrow text-rose-deep">Rosé-tinted preview</div>
        <p className="mt-1 text-[13px] text-ink">
          Live quote feeds are napping for a beat — the summary below is a
          plausible snapshot so you can see the layout. Real prices return
          automatically when Alpha Vantage resets (midnight UTC) or the Yahoo
          throttle clears.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero: big SPY chart                                                        */
/* -------------------------------------------------------------------------- */

function HeroCard({ hero }: { hero: MarketSummaryPayload["hero"] }) {
  const up = (hero.quote?.changePct ?? 0) >= 0;

  return (
    <article className="border border-ink/10 bg-paper lg:col-span-8">
      <header className="flex items-start justify-between gap-4 border-b border-ink/10 px-6 py-5">
        <div>
          <div className="eyebrow">Market summary · S&amp;P 500</div>
          <div className="mt-2 flex items-baseline gap-4">
            <h3 className="font-display text-4xl font-semibold leading-none tracking-tight">
              {hero.name}
            </h3>
            <span className="inline-flex h-6 items-center bg-ink text-[10px] uppercase tracking-[0.22em] text-paper px-2">
              {hero.badge}
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-4">
            <div className="num font-display text-5xl font-semibold leading-none text-ink md:text-6xl">
              {hero.quote ? formatNumber(hero.quote.price, 2) : "—"}
            </div>
            <div className="eyebrow text-ink-mute">
              {hero.quote?.currency ?? "USD"}
            </div>
            {hero.quote && (
              <div
                className={cn(
                  "num ml-1 inline-flex items-baseline gap-1 rounded-full px-2.5 py-0.5 text-sm",
                  up
                    ? "bg-rose/20 text-rose-deep"
                    : "bg-plum/15 text-plum"
                )}
              >
                <span>{up ? "▲" : "▼"}</span>
                <span>{formatPercent(hero.quote.changePct, 2)}</span>
              </div>
            )}
          </div>
          {hero.quote?.stale && (
            <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-rose-deep">
              Cached quote · {hero.quote.note ?? "upstream delayed"}
            </p>
          )}
        </div>
      </header>

      <div className="px-4 py-4">
        {hero.history && hero.history.points.length > 1 ? (
          <Sparkline
            points={hero.history.points}
            width={820}
            height={260}
            strokeWidth={2}
            showArea
            showAxis
            tone="pink"
            className="w-full"
            ariaLabel={`${hero.name} daily closes, last ${hero.history.points.length} sessions`}
          />
        ) : (
          <div
            className="flex h-[260px] items-center justify-center border border-dashed border-ink/10 text-sm text-ink-mute"
          >
            {hero.historyError
              ? `Chart unavailable — ${hero.historyError}`
              : "Chart unavailable"}
          </div>
        )}
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Indices rail                                                               */
/* -------------------------------------------------------------------------- */

function IndicesRail({ items }: { items: SummaryQuote[] }) {
  return (
    <aside className="border border-ink/10 bg-paper-sub lg:col-span-4">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <div>
          <div className="eyebrow">Major indices</div>
          <p className="mt-1 text-[11px] text-ink-mute">
            ETF proxies for the world's benchmarks
          </p>
        </div>
      </div>
      <ul className="divide-y divide-ink/10">
        {items.map((item) => (
          <IndexRow key={item.symbol} item={item} />
        ))}
      </ul>
      <div className="border-t border-ink/10 px-5 py-3 text-right">
        <Link
          href="/wavick"
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.22em] text-rose-deep hover:text-ruby"
        >
          Ask Wavick for a take
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </aside>
  );
}

function IndexRow({ item }: { item: SummaryQuote }) {
  const q = item.quote;
  const up = (q?.changePct ?? 0) >= 0;
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3">
      <IndexAvatar symbol={item.symbol} />
      <div>
        <div className="font-display text-base font-medium leading-tight text-ink">
          {nameForSymbol(item.symbol)}
        </div>
        <div className="num text-[11px] text-ink-mute">{item.symbol}</div>
      </div>
      <div className="text-right leading-tight">
        {q ? (
          <>
            <div className="num text-sm font-medium text-ink">
              {formatNumber(q.price, 2)}
              <span className="ml-1 eyebrow text-ink-mute">
                {q.currency ?? "USD"}
              </span>
            </div>
            <div
              className={cn(
                "num text-[11px]",
                up ? "text-signal-up" : "text-signal-down"
              )}
            >
              {formatPercent(q.changePct, 2)}
            </div>
          </>
        ) : (
          <span className="eyebrow text-ink-mute">—</span>
        )}
      </div>
    </li>
  );
}

function IndexAvatar({ symbol }: { symbol: string }) {
  // Hand-picked color + monogram per index so the rail reads at a glance,
  // echoing the Google Finance circular badges in the reference screenshot.
  const config: Record<string, { bg: string; text: string; mono: string }> = {
    QQQ: { bg: "bg-[#1f355e]", text: "text-white", mono: "100" },
    DIA: { bg: "bg-[#9c3d2f]", text: "text-white", mono: "DJ" },
    IWM: { bg: "bg-[#2f5f3f]", text: "text-white", mono: "RTY" },
    EFA: { bg: "bg-[#46576e]", text: "text-white", mono: "EAFE" },
    EWJ: { bg: "bg-[#2a3b8a]", text: "text-white", mono: "225" },
    VGK: { bg: "bg-[#5d3a7d]", text: "text-white", mono: "EU" },
  };
  const c = config[symbol] ?? {
    bg: "bg-ink/10",
    text: "text-ink",
    mono: symbol.slice(0, 3),
  };
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase tracking-tight",
        c.bg,
        c.text
      )}
    >
      {c.mono}
    </div>
  );
}

function nameForSymbol(symbol: string): string {
  const map: Record<string, string> = {
    QQQ: "Nasdaq 100",
    DIA: "Dow Jones 30",
    IWM: "Russell 2000",
    EFA: "MSCI EAFE",
    EWJ: "MSCI Japan",
    VGK: "FTSE Europe",
    IBIT: "iShares Bitcoin",
    ETHA: "iShares Ethereum",
    FBTC: "Fidelity BTC",
    BITB: "Bitwise BTC",
    UUP: "US Dollar Index",
    GLD: "Gold",
    USO: "Crude Oil (WTI)",
    UNG: "Natural Gas",
    TLT: "20+ Year Treasury",
    "EUR/USD": "Euro / US Dollar",
    "GBP/USD": "Pound / US Dollar",
    "USD/JPY": "Dollar / Yen",
    SPY: "S&P 500",
  };
  return map[symbol] ?? symbol;
}

/* -------------------------------------------------------------------------- */
/* Three summary cards                                                        */
/* -------------------------------------------------------------------------- */

function SummaryCard({ card }: { card: MarketSummaryPayload["cards"][number] }) {
  const leader = card.items.find((i) => i.quote) ?? card.items[0];
  const leaderQuote = leader?.quote;
  const up = (leaderQuote?.changePct ?? 0) >= 0;

  return (
    <article className="border border-ink/10 bg-paper">
      <header className="flex items-baseline justify-between border-b border-ink/10 px-5 py-4">
        <div>
          <div className="eyebrow">{card.eyebrow}</div>
          <h3 className="mt-1 font-display text-2xl font-semibold text-ink">
            {card.title}
          </h3>
        </div>
        {leaderQuote && (
          <div className="text-right">
            <div className="num text-lg font-medium">
              {formatNumber(leaderQuote.price, 2)}
            </div>
            <div
              className={cn(
                "num text-[11px]",
                up ? "text-signal-up" : "text-signal-down"
              )}
            >
              {formatPercent(leaderQuote.changePct, 2)}
            </div>
          </div>
        )}
      </header>
      <ul className="divide-y divide-ink/10">
        {card.items.map((item) => (
          <CardRow key={item.symbol} item={item} />
        ))}
      </ul>
    </article>
  );
}

function CardRow({ item }: { item: SummaryQuote }) {
  const q = item.quote;
  const up = (q?.changePct ?? 0) >= 0;
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3">
      <div>
        <div className="font-display text-sm font-medium text-ink">
          {nameForSymbol(item.symbol)}
        </div>
        <div className="num text-[11px] text-ink-mute">{item.symbol}</div>
      </div>
      <div className="text-right leading-tight">
        {q ? (
          <>
            <div className="num text-sm text-ink">
              {formatNumber(q.price, 2)}
              <span className="ml-1 eyebrow text-ink-mute">
                {q.currency ?? "USD"}
              </span>
            </div>
            <div
              className={cn(
                "num text-[11px]",
                up ? "text-signal-up" : "text-signal-down"
              )}
            >
              {formatPercent(q.changePct, 2)}
            </div>
          </>
        ) : (
          <span className="eyebrow text-ink-mute">
            {item.error ? "rate-limited" : "—"}
          </span>
        )}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading skeleton                                                           */
/* -------------------------------------------------------------------------- */

function SummarySkeleton({ error }: { error?: string } = {}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="h-[360px] animate-pulse border border-ink/10 bg-paper-sub lg:col-span-8" />
        <div className="h-[360px] animate-pulse border border-ink/10 bg-paper-sub lg:col-span-4" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-64 animate-pulse border border-ink/10 bg-paper-sub" />
        <div className="h-64 animate-pulse border border-ink/10 bg-paper-sub" />
        <div className="h-64 animate-pulse border border-ink/10 bg-paper-sub" />
      </div>
      {error && (
        <p className="font-mono text-xs text-signal-down">
          Summary unavailable: {error}
        </p>
      )}
    </div>
  );
}
