import type { HistoricalSeries, Quote } from "@/lib/types";

// Quotes are cached for a minute; plenty of freshness for an educational
// simulator and dramatically cuts upstream load (Yahoo will 429 a small IP
// that opens parallel chart requests every 30s).
const DEFAULT_TTL_MS = 60_000;
// If upstream is unreachable/rate-limited, we'll happily serve a quote up to
// 30 minutes old with a `stale: true` flag instead of returning nothing.
const MAX_STALE_MS = 30 * 60_000;

interface Entry {
  quote: Quote;
  expiresAt: number;
}

const quoteCache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Quote>>();

export function getFreshFromCache(symbol: string): Quote | undefined {
  const entry = quoteCache.get(symbol);
  if (!entry) return undefined;
  if (entry.expiresAt > Date.now()) return entry.quote;
  return undefined;
}

export function getAnyFromCache(symbol: string): Quote | undefined {
  return quoteCache.get(symbol)?.quote;
}

export function setCache(
  symbol: string,
  quote: Quote,
  ttlMs: number = DEFAULT_TTL_MS
) {
  quoteCache.set(symbol, {
    quote,
    expiresAt: Date.now() + ttlMs,
  });
}

export function getStaleButUsable(symbol: string): Quote | undefined {
  const entry = quoteCache.get(symbol);
  if (!entry) return undefined;
  const age = Date.now() - new Date(entry.quote.asOf).getTime();
  if (age > MAX_STALE_MS) return undefined;
  return entry.quote;
}

export async function dedupe<T extends Quote>(
  key: string,
  factory: () => Promise<T>
): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = factory().finally(() => inflight.delete(key));
  inflight.set(key, promise as Promise<Quote>);
  return promise;
}

// --- Historical series cache ------------------------------------------------
// Daily closes rarely change intraday, so we cache aggressively (12h fresh,
// up to 7 days stale) to survive Alpha Vantage's 25-req/day free tier.

const HISTORY_TTL_MS = 12 * 60 * 60_000; // 12h
const HISTORY_MAX_STALE_MS = 7 * 24 * 60 * 60_000; // 7d

interface HistoryEntry {
  series: HistoricalSeries;
  expiresAt: number;
  fetchedAt: number;
}

const historyCache = new Map<string, HistoryEntry>();
const historyInflight = new Map<string, Promise<HistoricalSeries>>();

function historyKey(symbol: string, days: number): string {
  return `${symbol}@${days}`;
}

export function getFreshHistory(
  symbol: string,
  days: number
): HistoricalSeries | undefined {
  const entry = historyCache.get(historyKey(symbol, days));
  if (!entry) return undefined;
  if (entry.expiresAt > Date.now()) return entry.series;
  return undefined;
}

export function getStaleHistory(
  symbol: string,
  days: number
): HistoricalSeries | undefined {
  const entry = historyCache.get(historyKey(symbol, days));
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > HISTORY_MAX_STALE_MS) return undefined;
  return { ...entry.series, stale: true };
}

export function setHistoryCache(
  symbol: string,
  days: number,
  series: HistoricalSeries,
  ttlMs: number = HISTORY_TTL_MS
) {
  historyCache.set(historyKey(symbol, days), {
    series,
    expiresAt: Date.now() + ttlMs,
    fetchedAt: Date.now(),
  });
}

export async function dedupeHistory(
  symbol: string,
  days: number,
  factory: () => Promise<HistoricalSeries>
): Promise<HistoricalSeries> {
  const key = historyKey(symbol, days);
  const pending = historyInflight.get(key);
  if (pending) return pending;
  const promise = factory().finally(() => historyInflight.delete(key));
  historyInflight.set(key, promise);
  return promise;
}
