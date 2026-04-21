import "server-only";
import dns from "node:dns";

// Node's fetch (undici) can hang for ~10s when a host's IPv6 route is
// misbehaving while IPv4 works fine — observed on Yahoo from some networks.
// Prefer IPv4 on the server to keep outbound market-data calls responsive.
// Safe no-op if the host supports IPv6 properly.
dns.setDefaultResultOrder("ipv4first");

import type {
  HistoricalSeries,
  Instrument,
  Quote,
} from "@/lib/types";
import { MarketDataError, type MarketDataAdapter } from "./types";
import { createAlphaVantageAdapter } from "./adapters/alphaVantage";
import { createYahooAdapter } from "./adapters/yahoo";
import {
  dedupe,
  dedupeHistory,
  getFreshFromCache,
  getFreshHistory,
  getStaleButUsable,
  getStaleHistory,
  setCache,
  setHistoryCache,
} from "./cache";
import {
  buildDemoHistory,
  buildDemoQuote,
  hasDemoSeed,
} from "./demo-data";

type ProviderId = "yahoo" | "alpha-vantage";

interface AdapterCache {
  primary: MarketDataAdapter;
  secondary?: MarketDataAdapter;
}
let cached: AdapterCache | undefined;

function selectProvider(): ProviderId {
  const raw = (process.env.MARKET_DATA_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "alpha-vantage" || raw === "alphavantage" || raw === "av") {
    return "alpha-vantage";
  }
  if (raw === "yahoo") return "yahoo";
  // Auto: if the user dropped in an Alpha Vantage key, use it (reliable).
  // Otherwise fall back to Yahoo (keyless, but best-effort since Yahoo's
  // unofficial endpoints rate-limit server IPs aggressively).
  if (process.env.ALPHA_VANTAGE_API_KEY) return "alpha-vantage";
  return "yahoo";
}

function getAdapters(): AdapterCache {
  if (cached) return cached;
  const provider = selectProvider();

  if (provider === "alpha-vantage") {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) {
      throw new MarketDataError(
        "ALPHA_VANTAGE_API_KEY is not set",
        "missing_key"
      );
    }
    cached = {
      primary: createAlphaVantageAdapter({ apiKey }),
      // Yahoo is keyless and makes a reasonable safety net when the AV
      // free tier (25 requests/day) trips mid-session.
      secondary: createYahooAdapter(),
    };
    return cached;
  }

  cached = { primary: createYahooAdapter() };
  return cached;
}

function isFallbackWorthy(err: unknown): boolean {
  return (
    err instanceof MarketDataError &&
    (err.code === "rate_limited" ||
      err.code === "upstream_error" ||
      err.code === "network_error")
  );
}

export function getProviderId(): ProviderId {
  return selectProvider();
}

// Throttle outbound provider calls. Yahoo's free endpoints 429 aggressively
// when a client opens parallel chart requests from the same IP, so we
// serialize and add a small stagger to look like a polite browser.
const MAX_CONCURRENT_UPSTREAM = 1;
const INTER_REQUEST_MS = 120;
let activeUpstream = 0;
const upstreamQueue: Array<() => void> = [];
let lastRequestAt = 0;

function acquireUpstreamSlot(): Promise<void> {
  if (activeUpstream < MAX_CONCURRENT_UPSTREAM) {
    activeUpstream++;
    return Promise.resolve();
  }
  return new Promise((resolve) => upstreamQueue.push(resolve));
}

function releaseUpstreamSlot() {
  const next = upstreamQueue.shift();
  if (next) {
    next();
  } else {
    activeUpstream = Math.max(0, activeUpstream - 1);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchThrottled(
  symbol: string,
  adapter: MarketDataAdapter
): Promise<Quote> {
  await acquireUpstreamSlot();
  try {
    const wait = INTER_REQUEST_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    try {
      return await adapter.getQuote(symbol);
    } finally {
      lastRequestAt = Date.now();
    }
  } finally {
    releaseUpstreamSlot();
  }
}

async function fetchQuoteWithFallback(symbol: string): Promise<Quote> {
  const { primary, secondary } = getAdapters();
  try {
    return await fetchThrottled(symbol, primary);
  } catch (err) {
    if (secondary && isFallbackWorthy(err)) {
      try {
        const q = await fetchThrottled(symbol, secondary);
        // Annotate the quote so UI can hint that we're on the fallback.
        return { ...q, note: q.note ?? `${primary.id} unavailable; served by ${secondary.id}` };
      } catch {
        // Surface the original error — that's the one the operator cares about.
        throw err;
      }
    }
    throw err;
  }
}

export async function getQuote(symbol: string): Promise<Quote> {
  const fresh = getFreshFromCache(symbol);
  if (fresh) return fresh;

  return dedupe(symbol, async () => {
    try {
      const quote = await fetchQuoteWithFallback(symbol);
      setCache(symbol, quote);
      return quote;
    } catch (err) {
      // 1st choice: a stale-but-recent quote we served earlier.
      const stale = getStaleButUsable(symbol);
      if (stale) {
        return {
          ...stale,
          stale: true,
          note:
            err instanceof MarketDataError && err.code === "rate_limited"
              ? "Rate limited; showing cached quote."
              : "Upstream unavailable; showing cached quote.",
        } satisfies Quote;
      }
      // 2nd choice: demo seed, if we have one for this symbol. Tagged
      // `source: "demo"` so the UI can render a clear banner. Only
      // triggers on rate-limit/upstream/network errors — genuine 404s
      // ("symbol doesn't exist") still throw through.
      if (isFallbackWorthy(err) && hasDemoSeed(symbol)) {
        const demo = buildDemoQuote(symbol);
        if (demo) {
          setCache(symbol, demo);
          return demo;
        }
      }
      throw err;
    }
  });
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const unique = Array.from(
    new Set(symbols.map((s) => s.trim()).filter(Boolean))
  );
  const results = await Promise.allSettled(unique.map((s) => getQuote(s)));
  const quotes: Quote[] = [];
  let rateLimitedCount = 0;
  for (let i = 0; i < unique.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      quotes.push(r.value);
      continue;
    }
    const reason = r.reason;
    if (reason instanceof MarketDataError && reason.code === "rate_limited") {
      rateLimitedCount++;
    }
    const msg =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : String(reason);
    console.warn(`[market-data] ${unique[i]} -> ${msg}`);
  }
  // If every symbol failed and at least one was rate-limited, surface that
  // clearly to the caller so the route handler can return 429.
  if (quotes.length === 0 && unique.length > 0 && rateLimitedCount > 0) {
    throw new MarketDataError(
      `Market data provider (${selectProvider()}) rate-limited all ${unique.length} symbol(s). ` +
        `Try again in a minute, or set ALPHA_VANTAGE_API_KEY in .env for a reliable provider.`,
      "rate_limited"
    );
  }
  return quotes;
}

export async function searchSymbols(query: string): Promise<Instrument[]> {
  const { primary, secondary } = getAdapters();
  try {
    return await primary.search(query);
  } catch (err) {
    if (secondary && isFallbackWorthy(err)) {
      return secondary.search(query);
    }
    throw err;
  }
}

async function fetchHistoryOnce(
  symbol: string,
  days: number,
  adapter: MarketDataAdapter
): Promise<HistoricalSeries> {
  if (!adapter.getHistory) {
    throw new MarketDataError(
      `Provider ${adapter.id} does not support history`,
      "upstream_error"
    );
  }
  await acquireUpstreamSlot();
  try {
    const wait = INTER_REQUEST_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    try {
      const points = await adapter.getHistory(symbol, days);
      return { symbol, points, source: adapter.id, stale: false };
    } finally {
      lastRequestAt = Date.now();
    }
  } finally {
    releaseUpstreamSlot();
  }
}

export async function getHistory(
  symbol: string,
  days: number
): Promise<HistoricalSeries> {
  const fresh = getFreshHistory(symbol, days);
  if (fresh) return fresh;

  return dedupeHistory(symbol, days, async () => {
    const { primary, secondary } = getAdapters();
    try {
      const series = await fetchHistoryOnce(symbol, days, primary);
      setHistoryCache(symbol, days, series);
      return series;
    } catch (err) {
      if (secondary && isFallbackWorthy(err)) {
        try {
          const series = await fetchHistoryOnce(symbol, days, secondary);
          setHistoryCache(symbol, days, series);
          return series;
        } catch {
          // fall through to stale cache check
        }
      }
      const fallback = getStaleHistory(symbol, days);
      if (fallback) return fallback;
      if (isFallbackWorthy(err) && hasDemoSeed(symbol)) {
        const demo = buildDemoHistory(symbol, days);
        if (demo) {
          setHistoryCache(symbol, days, demo);
          return demo;
        }
      }
      throw err;
    }
  });
}

export { MarketDataError } from "./types";
