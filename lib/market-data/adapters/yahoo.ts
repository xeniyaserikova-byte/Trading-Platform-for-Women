import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HistoricalPoint, Instrument, Quote } from "@/lib/types";
import {
  MarketDataError,
  parseSymbol,
  type MarketDataAdapter,
} from "../types";

const execFileP = promisify(execFile);

const QUOTE_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const SEARCH_BASE = "https://query1.finance.yahoo.com/v1/finance/search";

/**
 * Detect whether we're running inside a serverless container. Used to
 * auto-disable the curl subprocess in production: Netlify / Vercel / AWS
 * Lambda environments don't reliably ship curl and native fetch is faster.
 */
function isServerless(): boolean {
  return (
    !!process.env.NETLIFY ||
    !!process.env.VERCEL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

export interface YahooAdapterOptions {
  fetchImpl?: typeof fetch;
  quoteBase?: string;
  searchBase?: string;
  /**
   * When true, uses a `curl` subprocess instead of Node's fetch. Yahoo's
   * edge fingerprints Node's undici/OpenSSL TLS signature and 429s it even
   * from fresh IPs, while curl sails through. Defaults to true on server.
   */
  useCurl?: boolean;
}

interface CurlResult {
  status: number;
  body: string;
}

async function curlGet(
  url: string,
  headers: Record<string, string>
): Promise<CurlResult> {
  const args = [
    "-sS",
    "-L",
    "--max-time",
    "10",
    "-o",
    "-",
    "-w",
    "\n__STATUS__%{http_code}",
  ];
  for (const [k, v] of Object.entries(headers)) {
    args.push("-H", `${k}: ${v}`);
  }
  args.push(url);
  try {
    const { stdout } = await execFileP("curl", args, {
      maxBuffer: 4 * 1024 * 1024,
      env: process.env,
    });
    const idx = stdout.lastIndexOf("\n__STATUS__");
    if (idx === -1) {
      throw new MarketDataError("Malformed curl output", "upstream_error");
    }
    const body = stdout.slice(0, idx);
    const status = Number(stdout.slice(idx + "\n__STATUS__".length).trim());
    return { body, status };
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    const e = err as NodeJS.ErrnoException & {
      stderr?: string;
      stdout?: string;
      code?: string | number;
    };
    const detail =
      e.stderr?.trim() || e.message || (e.code ? `code ${e.code}` : "unknown");
    throw new MarketDataError(
      `curl subprocess failed: ${detail}`,
      "network_error",
      err
    );
  }
}

interface YahooChartMeta {
  currency?: string;
  symbol?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketTime?: number;
  instrumentType?: string;
  longName?: string;
  shortName?: string;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    }> | null;
    error?: { code?: string; description?: string } | null;
  };
}

interface YahooSearchHit {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
  typeDisp?: string;
  isYahooFinance?: boolean;
}

interface YahooSearchResponse {
  quotes?: YahooSearchHit[];
}

export function createYahooAdapter(
  opts: YahooAdapterOptions = {}
): MarketDataAdapter {
  const {
    fetchImpl = fetch,
    quoteBase = QUOTE_BASE,
    searchBase = SEARCH_BASE,
    // If the caller injected a fetch mock (tests), always use it. Otherwise
    // default to curl-subprocess mode locally, but flip to native fetch when
    // we're running in a serverless container (Netlify / Vercel / Lambda) —
    // those environments don't ship curl reliably and the subprocess
    // overhead wastes cold-start time.
    useCurl = opts.fetchImpl
      ? false
      : process.env.YAHOO_FETCH_MODE === "fetch"
        ? false
        : process.env.YAHOO_FETCH_MODE === "curl"
          ? true
          : !isServerless(),
  } = opts;

  const headers = {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://finance.yahoo.com/",
    Origin: "https://finance.yahoo.com",
  };

  async function call<T>(url: string): Promise<T> {
    if (useCurl) {
      const { status, body } = await curlGet(url, headers);
      if (status === 429)
        throw new MarketDataError("Yahoo rate-limited", "rate_limited");
      if (status === 404)
        throw new MarketDataError("Symbol not found", "not_found");
      if (status < 200 || status >= 300) {
        throw new MarketDataError(
          `Upstream error ${status}`,
          "upstream_error"
        );
      }
      try {
        return JSON.parse(body) as T;
      } catch (err) {
        throw new MarketDataError(
          "Invalid upstream JSON",
          "upstream_error",
          err
        );
      }
    }

    let res: Response;
    try {
      res = await fetchImpl(url, { cache: "no-store", headers });
    } catch (err) {
      throw new MarketDataError("Network error", "network_error", err);
    }
    if (res.status === 429) {
      throw new MarketDataError("Yahoo rate-limited", "rate_limited");
    }
    if (res.status === 404) {
      throw new MarketDataError("Symbol not found", "not_found");
    }
    if (!res.ok) {
      throw new MarketDataError(
        `Upstream error ${res.status}`,
        "upstream_error"
      );
    }
    try {
      return (await res.json()) as T;
    } catch (err) {
      throw new MarketDataError("Invalid upstream JSON", "upstream_error", err);
    }
  }

  async function getQuote(symbolInput: string): Promise<Quote> {
    const parsed = parseSymbol(symbolInput);
    const yahooSymbol = toYahooSymbol(parsed.symbol, parsed.assetClass);
    const url =
      `${quoteBase}/${encodeURIComponent(yahooSymbol)}` +
      `?interval=1d&range=5d`;
    const json = await call<YahooChartResponse>(url);

    if (json.chart?.error) {
      throw new MarketDataError(
        json.chart.error.description ?? "Upstream error",
        "upstream_error"
      );
    }
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice == null) {
      throw new MarketDataError(`No quote for ${parsed.symbol}`, "not_found");
    }
    return normalizeMeta(meta, parsed.symbol, parsed.assetClass);
  }

  async function search(query: string): Promise<Instrument[]> {
    const q = query.trim();
    if (!q) return [];
    const url =
      `${searchBase}?q=${encodeURIComponent(q)}` +
      `&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;
    const json = await call<YahooSearchResponse>(url);
    return normalizeSearch(json);
  }

  async function getHistory(
    symbolInput: string,
    days: number
  ): Promise<HistoricalPoint[]> {
    const parsed = parseSymbol(symbolInput);
    const yahooSymbol = toYahooSymbol(parsed.symbol, parsed.assetClass);
    const range = pickRange(days);
    const url =
      `${quoteBase}/${encodeURIComponent(yahooSymbol)}` +
      `?interval=1d&range=${range}`;
    const json = await call<YahooChartResponse>(url);

    if (json.chart?.error) {
      throw new MarketDataError(
        json.chart.error.description ?? "Upstream error",
        "upstream_error"
      );
    }
    return normalizeHistory(json, days);
  }

  return { id: "yahoo", getQuote, search, getHistory };
}

function pickRange(days: number): string {
  if (days <= 7) return "7d";
  if (days <= 31) return "1mo";
  if (days <= 95) return "3mo";
  if (days <= 190) return "6mo";
  if (days <= 380) return "1y";
  return "2y";
}

export function toYahooSymbol(
  canonical: string,
  assetClass: "stock" | "fx"
): string {
  if (assetClass === "fx") {
    // "EUR/USD" -> "EURUSD=X"
    return canonical.replace("/", "") + "=X";
  }
  return canonical;
}

export function normalizeMeta(
  meta: YahooChartMeta,
  canonicalSymbol: string,
  assetClass: "stock" | "fx"
): Quote {
  const price = meta.regularMarketPrice as number;
  const prev =
    meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prev;
  const changePct = prev !== 0 ? (change / prev) * 100 : 0;
  const asOf = meta.regularMarketTime
    ? new Date(meta.regularMarketTime * 1000).toISOString()
    : new Date().toISOString();

  return {
    symbol: canonicalSymbol,
    assetClass,
    price,
    change,
    changePct,
    asOf,
    currency: meta.currency ?? (assetClass === "fx" ? "USD" : "USD"),
    stale: false,
    source: "yahoo",
  };
}

export function normalizeHistory(
  json: YahooChartResponse,
  days: number
): HistoricalPoint[] {
  const result = json.chart?.result?.[0];
  const ts = result?.timestamp;
  const closeSeries =
    result?.indicators?.adjclose?.[0]?.adjclose ??
    result?.indicators?.quote?.[0]?.close;
  if (!ts || !closeSeries) return [];
  const points: HistoricalPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closeSeries[i];
    if (c == null || !Number.isFinite(c)) continue;
    points.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      close: c,
    });
  }
  // Trim to the last `days` data points so chart scaling stays consistent
  // regardless of the upstream's range granularity.
  return points.slice(-Math.max(days, 2));
}

export function normalizeSearch(json: YahooSearchResponse): Instrument[] {
  const hits = json.quotes ?? [];
  const out: Instrument[] = [];
  for (const h of hits) {
    if (!h.symbol) continue;
    const type = (h.quoteType ?? "").toUpperCase();
    // Supported: equities, ETFs, indices, and currency pairs
    if (
      type !== "EQUITY" &&
      type !== "ETF" &&
      type !== "INDEX" &&
      type !== "CURRENCY" &&
      type !== "MUTUALFUND"
    ) {
      continue;
    }
    const isFx = type === "CURRENCY" || h.symbol.endsWith("=X");
    const symbol = isFx ? fromYahooFxSymbol(h.symbol) : h.symbol;
    if (!symbol) continue;
    out.push({
      symbol,
      name: h.longname ?? h.shortname ?? symbol,
      assetClass: isFx ? "fx" : "stock",
      region: h.exchDisp,
    });
  }
  return out;
}

function fromYahooFxSymbol(sym: string): string | null {
  // "EURUSD=X" -> "EUR/USD"
  const m = sym.match(/^([A-Z]{3})([A-Z]{3})=X$/);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}
