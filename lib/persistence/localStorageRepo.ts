import type { Portfolio, Trade } from "@/lib/types";
import {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_STARTING_CASH,
  DEFAULT_WATCHLIST,
  type PortfolioRepo,
  type WatchlistItem,
} from "./types";

const SCHEMA_VERSION = 1;
const KEY_PORTFOLIO = `ats:v${SCHEMA_VERSION}:portfolio`;
const KEY_TRADES = `ats:v${SCHEMA_VERSION}:trades`;
const KEY_WATCHLIST = `ats:v${SCHEMA_VERSION}:watchlist`;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function safeRead<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota/serialization errors
  }
}

const defaultPortfolio = (): Portfolio => ({
  cash: DEFAULT_STARTING_CASH,
  baseCurrency: DEFAULT_BASE_CURRENCY,
  positions: [],
});

export const localStorageRepo: PortfolioRepo = {
  loadPortfolio() {
    const stored = safeRead<Portfolio | null>(KEY_PORTFOLIO, null);
    if (!stored || typeof stored.cash !== "number") {
      const seed = defaultPortfolio();
      safeWrite(KEY_PORTFOLIO, seed);
      return seed;
    }
    return {
      cash: stored.cash,
      baseCurrency: stored.baseCurrency ?? DEFAULT_BASE_CURRENCY,
      positions: Array.isArray(stored.positions) ? stored.positions : [],
    };
  },
  savePortfolio(portfolio) {
    safeWrite(KEY_PORTFOLIO, portfolio);
  },
  listTrades() {
    const raw = safeRead<Trade[]>(KEY_TRADES, []);
    return Array.isArray(raw) ? raw : [];
  },
  appendTrade(trade) {
    const existing = this.listTrades();
    safeWrite(KEY_TRADES, [trade, ...existing]);
  },
  getWatchlist() {
    const raw = safeRead<WatchlistItem[] | null>(KEY_WATCHLIST, null);
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
      safeWrite(KEY_WATCHLIST, DEFAULT_WATCHLIST);
      return [...DEFAULT_WATCHLIST];
    }
    return raw;
  },
  setWatchlist(items) {
    safeWrite(KEY_WATCHLIST, items);
  },
  resetAll() {
    if (!hasStorage()) return;
    window.localStorage.removeItem(KEY_PORTFOLIO);
    window.localStorage.removeItem(KEY_TRADES);
    window.localStorage.removeItem(KEY_WATCHLIST);
  },
};
