import type { Portfolio, Trade } from "@/lib/types";

export interface WatchlistItem {
  symbol: string;
  assetClass: "stock" | "fx";
  name?: string;
}

export interface PortfolioRepo {
  loadPortfolio(): Portfolio;
  savePortfolio(portfolio: Portfolio): void;
  listTrades(): Trade[];
  appendTrade(trade: Trade): void;
  getWatchlist(): WatchlistItem[];
  setWatchlist(items: WatchlistItem[]): void;
  resetAll(): void;
}

export const DEFAULT_STARTING_CASH = 100_000;
export const DEFAULT_BASE_CURRENCY = "USD";

export const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: "AAPL", assetClass: "stock", name: "Apple Inc." },
  { symbol: "MSFT", assetClass: "stock", name: "Microsoft Corp." },
  { symbol: "TSLA", assetClass: "stock", name: "Tesla Inc." },
  { symbol: "SPY", assetClass: "stock", name: "SPDR S&P 500 ETF" },
  { symbol: "EUR/USD", assetClass: "fx", name: "Euro / US Dollar" },
];
