import type {
  AssetClass,
  HistoricalPoint,
  Instrument,
  Quote,
} from "@/lib/types";

export type { AssetClass, HistoricalPoint, Instrument, Quote };

export interface MarketDataAdapter {
  readonly id: string;
  getQuote(symbol: string): Promise<Quote>;
  search(query: string): Promise<Instrument[]>;
  /**
   * Optional: daily close history, oldest to newest. `days` is a soft hint —
   * adapters may return more or fewer points depending on range granularity.
   */
  getHistory?(symbol: string, days: number): Promise<HistoricalPoint[]>;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "rate_limited"
      | "not_found"
      | "invalid_symbol"
      | "missing_key"
      | "upstream_error"
      | "network_error",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

export interface ParsedSymbol {
  symbol: string;
  assetClass: AssetClass;
  fx?: { from: string; to: string };
}

export function parseSymbol(input: string): ParsedSymbol {
  const raw = input.trim().toUpperCase();
  const fxMatch = raw.match(/^([A-Z]{3})[\/:-]?([A-Z]{3})$/);
  if (fxMatch && raw.length <= 7 && raw !== "USDUSD") {
    const [, from, to] = fxMatch;
    if (isLikelyCurrency(from) && isLikelyCurrency(to)) {
      return {
        symbol: `${from}/${to}`,
        assetClass: "fx",
        fx: { from, to },
      };
    }
  }
  return {
    symbol: raw,
    assetClass: "stock",
  };
}

const COMMON_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
  "NZD",
  "CNY",
  "HKD",
  "SGD",
  "SEK",
  "NOK",
  "DKK",
  "MXN",
  "BRL",
  "INR",
  "KRW",
  "TRY",
  "ZAR",
  "PLN",
]);

function isLikelyCurrency(code: string) {
  return COMMON_CURRENCIES.has(code);
}
