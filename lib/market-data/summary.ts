import "server-only";
import type {
  HistoricalSeries,
  Quote,
} from "@/lib/types";
import { getHistory, getQuote } from "./provider";
import { buildDemoHistory, buildDemoQuote, hasDemoSeed } from "./demo-data";

/**
 * The curated set of instruments we render on the Market Summary dashboard.
 * We lean on liquid ETFs / FX pairs so that both Yahoo and Alpha Vantage can
 * service every symbol without special endpoints.
 */
export interface SummaryInstrument {
  symbol: string;
  name: string;
  region?: string;
}

export interface SummaryCard {
  id: string;
  title: string;
  eyebrow: string;
  instruments: SummaryInstrument[];
}

export const SUMMARY_HERO_SYMBOL = "SPY";
export const SUMMARY_HERO_NAME = "S&P 500";
export const SUMMARY_HERO_BADGE = "SPX";
export const SUMMARY_HISTORY_DAYS = 30;

export const SUMMARY_INDICES: SummaryInstrument[] = [
  { symbol: "QQQ", name: "Nasdaq 100", region: "US" },
  { symbol: "DIA", name: "Dow Jones 30", region: "US" },
  { symbol: "IWM", name: "Russell 2000", region: "US" },
  { symbol: "EFA", name: "MSCI EAFE", region: "Europe / Asia" },
  { symbol: "EWJ", name: "MSCI Japan", region: "Japan" },
  { symbol: "VGK", name: "FTSE Europe", region: "Europe" },
];

export const SUMMARY_CARDS: SummaryCard[] = [
  {
    id: "crypto",
    title: "Crypto",
    eyebrow: "Spot ETFs",
    instruments: [
      { symbol: "IBIT", name: "iShares Bitcoin Trust" },
      { symbol: "ETHA", name: "iShares Ethereum Trust" },
      { symbol: "FBTC", name: "Fidelity Wise Bitcoin" },
      { symbol: "BITB", name: "Bitwise Bitcoin ETF" },
    ],
  },
  {
    id: "commodities",
    title: "Commodities & Dollar",
    eyebrow: "ETF proxies",
    instruments: [
      { symbol: "UUP", name: "US Dollar Index" },
      { symbol: "GLD", name: "Gold" },
      { symbol: "USO", name: "Crude Oil (WTI)" },
      { symbol: "UNG", name: "Natural Gas" },
    ],
  },
  {
    id: "fx",
    title: "FX & Rates",
    eyebrow: "Major pairs",
    instruments: [
      { symbol: "EUR/USD", name: "Euro / US Dollar" },
      { symbol: "GBP/USD", name: "Pound / US Dollar" },
      { symbol: "USD/JPY", name: "Dollar / Yen" },
      { symbol: "TLT", name: "20+ Year Treasury" },
    ],
  },
];

export interface SummaryQuote {
  symbol: string;
  quote?: Quote;
  error?: string;
}

export interface MarketSummary {
  hero: {
    symbol: string;
    name: string;
    badge: string;
    quote?: Quote;
    quoteError?: string;
    history?: HistoricalSeries;
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

/**
 * Build the full summary payload. Every upstream call is wrapped in a
 * Promise.allSettled so one failing symbol never takes down the page —
 * failed entries come back with an `error` message and the UI renders a dash.
 */
export async function buildMarketSummary(): Promise<MarketSummary> {
  const allSymbols = [
    SUMMARY_HERO_SYMBOL,
    ...SUMMARY_INDICES.map((i) => i.symbol),
    ...SUMMARY_CARDS.flatMap((c) => c.instruments.map((i) => i.symbol)),
  ];

  // One serialized fan-out through the provider's throttle. The provider
  // already caches aggressively, so a second call within 60s costs zero
  // upstream requests.
  const quoteResults = await Promise.allSettled(
    allSymbols.map((s) => getQuote(s))
  );
  const quoteBySymbol = new Map<string, Quote>();
  const errorBySymbol = new Map<string, string>();
  for (let i = 0; i < allSymbols.length; i++) {
    const r = quoteResults[i];
    if (r.status === "fulfilled") {
      quoteBySymbol.set(allSymbols[i], r.value);
    } else {
      const err = r.reason;
      errorBySymbol.set(
        allSymbols[i],
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // Hero history, cached for 12h server-side so a free-tier Alpha Vantage
  // key doesn't re-spend a request on every refresh.
  let history: HistoricalSeries | undefined;
  let historyError: string | undefined;
  try {
    history = await getHistory(SUMMARY_HERO_SYMBOL, SUMMARY_HISTORY_DAYS);
  } catch (err) {
    historyError = err instanceof Error ? err.message : String(err);
  }

  // Demo-data fallback: when every live upstream has refused us (AV daily
  // quota + Yahoo IP throttle), the dashboard would be a wall of "—". In
  // that scenario we seed each slot with a clearly-labelled demo quote so
  // the UI remains demonstrable. We flip `usingDemoData` so the component
  // can render a banner to the user.
  let usingDemoData = false;
  if (quoteBySymbol.size === 0 || allQuotesMissingSeeded(allSymbols, quoteBySymbol)) {
    for (const s of allSymbols) {
      if (quoteBySymbol.has(s)) continue;
      const demo = buildDemoQuote(s);
      if (demo) {
        quoteBySymbol.set(s, demo);
        usingDemoData = true;
      }
    }
    if (!history && hasDemoSeed(SUMMARY_HERO_SYMBOL)) {
      history = buildDemoHistory(SUMMARY_HERO_SYMBOL, SUMMARY_HISTORY_DAYS);
      if (history) usingDemoData = true;
    }
  }

  const toEntry = (symbol: string): SummaryQuote => ({
    symbol,
    quote: quoteBySymbol.get(symbol),
    error: quoteBySymbol.has(symbol) ? undefined : errorBySymbol.get(symbol),
  });

  return {
    hero: {
      symbol: SUMMARY_HERO_SYMBOL,
      name: SUMMARY_HERO_NAME,
      badge: SUMMARY_HERO_BADGE,
      quote: quoteBySymbol.get(SUMMARY_HERO_SYMBOL),
      quoteError: quoteBySymbol.has(SUMMARY_HERO_SYMBOL)
        ? undefined
        : errorBySymbol.get(SUMMARY_HERO_SYMBOL),
      history,
      historyError: history ? undefined : historyError,
    },
    indices: SUMMARY_INDICES.map((i) => toEntry(i.symbol)),
    cards: SUMMARY_CARDS.map((c) => ({
      id: c.id,
      title: c.title,
      eyebrow: c.eyebrow,
      items: c.instruments.map((i) => toEntry(i.symbol)),
    })),
    generatedAt: new Date().toISOString(),
    usingDemoData,
  };
}

/**
 * True when no symbol has a live quote AND every symbol we'd demo for is
 * missing — used as the trigger for the demo-data seed.
 */
function allQuotesMissingSeeded(
  allSymbols: string[],
  quoteBySymbol: Map<string, Quote>
): boolean {
  for (const s of allSymbols) {
    if (quoteBySymbol.has(s)) return false;
  }
  // Only seed demo data if we actually have seeds for the hero + some indices.
  // Otherwise, fall through and let the page render errors honestly.
  return allSymbols.some((s) => hasDemoSeed(s));
}

/** Lookup helpers used by the UI to label each row. */
export function getInstrumentName(symbol: string): string {
  if (symbol === SUMMARY_HERO_SYMBOL) return SUMMARY_HERO_NAME;
  const fromIndices = SUMMARY_INDICES.find((i) => i.symbol === symbol);
  if (fromIndices) return fromIndices.name;
  for (const c of SUMMARY_CARDS) {
    const hit = c.instruments.find((i) => i.symbol === symbol);
    if (hit) return hit.name;
  }
  return symbol;
}

export function getInstrumentRegion(symbol: string): string | undefined {
  if (symbol === SUMMARY_HERO_SYMBOL) return "US";
  return SUMMARY_INDICES.find((i) => i.symbol === symbol)?.region;
}
