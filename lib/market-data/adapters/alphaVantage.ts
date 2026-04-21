import type { HistoricalPoint, Instrument, Quote } from "@/lib/types";
import {
  MarketDataError,
  parseSymbol,
  type MarketDataAdapter,
} from "../types";

const BASE_URL = "https://www.alphavantage.co/query";

export interface AlphaVantageAdapterOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

interface RawGlobalQuote {
  "01. symbol"?: string;
  "05. price"?: string;
  "08. previous close"?: string;
  "09. change"?: string;
  "10. change percent"?: string;
  "07. latest trading day"?: string;
}

interface RawFxQuote {
  "1. From_Currency Code"?: string;
  "3. To_Currency Code"?: string;
  "5. Exchange Rate"?: string;
  "6. Last Refreshed"?: string;
}

interface RawSearchMatch {
  "1. symbol"?: string;
  "2. name"?: string;
  "3. type"?: string;
  "4. region"?: string;
  "8. currency"?: string;
}

type RawDailySeries = Record<
  string,
  Record<string, string | undefined> | undefined
>;

interface AlphaVantageEnvelope {
  Note?: string;
  Information?: string;
  "Error Message"?: string;
  "Global Quote"?: RawGlobalQuote;
  "Realtime Currency Exchange Rate"?: RawFxQuote;
  bestMatches?: RawSearchMatch[];
  "Time Series (Daily)"?: RawDailySeries;
  "Time Series FX (Daily)"?: RawDailySeries;
}

export function createAlphaVantageAdapter(
  opts: AlphaVantageAdapterOptions
): MarketDataAdapter {
  const { apiKey, fetchImpl = fetch, baseUrl = BASE_URL } = opts;

  async function call(params: Record<string, string>) {
    const url = new URL(baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("apikey", apiKey);

    let res: Response;
    try {
      res = await fetchImpl(url.toString(), { cache: "no-store" });
    } catch (err) {
      throw new MarketDataError("Network error", "network_error", err);
    }
    if (!res.ok) {
      throw new MarketDataError(
        `Upstream error ${res.status}`,
        "upstream_error"
      );
    }
    let json: AlphaVantageEnvelope;
    try {
      json = (await res.json()) as AlphaVantageEnvelope;
    } catch (err) {
      throw new MarketDataError("Invalid upstream JSON", "upstream_error", err);
    }
    if (json.Note || json.Information) {
      throw new MarketDataError(
        json.Note ?? json.Information ?? "Rate limit",
        "rate_limited"
      );
    }
    if (json["Error Message"]) {
      throw new MarketDataError(
        json["Error Message"] ?? "Invalid symbol",
        "invalid_symbol"
      );
    }
    return json;
  }

  async function getQuote(symbolInput: string): Promise<Quote> {
    const parsed = parseSymbol(symbolInput);

    if (parsed.assetClass === "fx" && parsed.fx) {
      const json = await call({
        function: "CURRENCY_EXCHANGE_RATE",
        from_currency: parsed.fx.from,
        to_currency: parsed.fx.to,
      });
      return normalizeFx(json, parsed.symbol);
    }

    const json = await call({
      function: "GLOBAL_QUOTE",
      symbol: parsed.symbol,
    });
    return normalizeStock(json, parsed.symbol);
  }

  async function search(query: string): Promise<Instrument[]> {
    const q = query.trim();
    if (!q) return [];
    const json = await call({ function: "SYMBOL_SEARCH", keywords: q });
    return normalizeSearch(json);
  }

  async function getHistory(
    symbolInput: string,
    days: number
  ): Promise<HistoricalPoint[]> {
    const parsed = parseSymbol(symbolInput);
    if (parsed.assetClass === "fx" && parsed.fx) {
      const json = await call({
        function: "FX_DAILY",
        from_symbol: parsed.fx.from,
        to_symbol: parsed.fx.to,
        outputsize: days > 100 ? "full" : "compact",
      });
      return normalizeDailySeries(
        json["Time Series FX (Daily)"],
        "4. close",
        days
      );
    }
    const json = await call({
      function: "TIME_SERIES_DAILY",
      symbol: parsed.symbol,
      outputsize: days > 100 ? "full" : "compact",
    });
    return normalizeDailySeries(
      json["Time Series (Daily)"],
      "4. close",
      days
    );
  }

  return { id: "alpha-vantage", getQuote, search, getHistory };
}

export function normalizeStock(
  json: AlphaVantageEnvelope,
  symbol: string
): Quote {
  const raw = json["Global Quote"];
  if (!raw || !raw["05. price"]) {
    throw new MarketDataError(`No quote for ${symbol}`, "not_found");
  }
  const price = num(raw["05. price"]);
  const change = num(raw["09. change"], 0);
  const changePctStr = raw["10. change percent"] ?? "0%";
  const changePct = num(changePctStr.replace(/%/g, ""), 0);
  return {
    symbol,
    assetClass: "stock",
    price,
    change,
    changePct,
    asOf: raw["07. latest trading day"]
      ? new Date(raw["07. latest trading day"]).toISOString()
      : new Date().toISOString(),
    currency: "USD",
    stale: false,
    source: "alpha-vantage",
  };
}

export function normalizeFx(
  json: AlphaVantageEnvelope,
  symbol: string
): Quote {
  const raw = json["Realtime Currency Exchange Rate"];
  if (!raw || !raw["5. Exchange Rate"]) {
    throw new MarketDataError(`No FX quote for ${symbol}`, "not_found");
  }
  const price = num(raw["5. Exchange Rate"]);
  const to = raw["3. To_Currency Code"] ?? "USD";
  return {
    symbol,
    assetClass: "fx",
    price,
    change: 0,
    changePct: 0,
    asOf: raw["6. Last Refreshed"]
      ? new Date(raw["6. Last Refreshed"].replace(" ", "T") + "Z").toISOString()
      : new Date().toISOString(),
    currency: to,
    stale: false,
    source: "alpha-vantage",
    note: "FX change not reported; shown as 0.",
  };
}

export function normalizeDailySeries(
  series: RawDailySeries | undefined,
  closeKey: string,
  days: number
): HistoricalPoint[] {
  if (!series) return [];
  const entries = Object.entries(series)
    .map(([date, row]) => {
      const closeStr = row?.[closeKey];
      if (closeStr == null) return null;
      const close = Number.parseFloat(closeStr);
      if (!Number.isFinite(close)) return null;
      return { date, close };
    })
    .filter((x): x is HistoricalPoint => x != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return entries.slice(-Math.max(days, 2));
}

export function normalizeSearch(
  json: AlphaVantageEnvelope
): Instrument[] {
  const matches = json.bestMatches ?? [];
  const result: Instrument[] = [];
  for (const m of matches) {
    const symbol = m["1. symbol"]?.trim();
    const name = m["2. name"]?.trim();
    if (!symbol || !name) continue;
    result.push({
      symbol,
      name,
      assetClass: "stock",
      region: m["4. region"],
      currency: m["8. currency"],
    });
  }
  return result;
}

function num(value: string | undefined, fallback?: number): number {
  if (value == null || value === "") {
    if (fallback != null) return fallback;
    return NaN;
  }
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) {
    if (fallback != null) return fallback;
    throw new MarketDataError(`Invalid numeric value: ${value}`, "upstream_error");
  }
  return n;
}
