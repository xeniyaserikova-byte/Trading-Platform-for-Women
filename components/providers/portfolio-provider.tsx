"use client";

import * as React from "react";
import type { Portfolio, Trade } from "@/lib/types";
import { localStorageRepo } from "@/lib/persistence/localStorageRepo";
import {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_STARTING_CASH,
  type PortfolioRepo,
  type WatchlistItem,
} from "@/lib/persistence/types";

interface PortfolioContextValue {
  hydrated: boolean;
  portfolio: Portfolio;
  trades: Trade[];
  watchlist: WatchlistItem[];
  setPortfolio: (p: Portfolio) => void;
  recordTrade: (trade: Trade, nextPortfolio: Portfolio) => void;
  addWatchlist: (item: WatchlistItem) => void;
  removeWatchlist: (symbol: string) => void;
  resetAll: () => void;
}

const PortfolioContext = React.createContext<PortfolioContextValue | null>(null);

const emptyPortfolio: Portfolio = {
  cash: DEFAULT_STARTING_CASH,
  baseCurrency: DEFAULT_BASE_CURRENCY,
  positions: [],
};

export function PortfolioProvider({
  children,
  repo = localStorageRepo,
}: {
  children: React.ReactNode;
  repo?: PortfolioRepo;
}) {
  const [hydrated, setHydrated] = React.useState(false);
  const [portfolio, setPortfolioState] = React.useState<Portfolio>(emptyPortfolio);
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [watchlist, setWatchlist] = React.useState<WatchlistItem[]>([]);

  React.useEffect(() => {
    setPortfolioState(repo.loadPortfolio());
    setTrades(repo.listTrades());
    setWatchlist(repo.getWatchlist());
    setHydrated(true);
  }, [repo]);

  const setPortfolio = React.useCallback(
    (p: Portfolio) => {
      setPortfolioState(p);
      repo.savePortfolio(p);
    },
    [repo]
  );

  const recordTrade = React.useCallback(
    (trade: Trade, nextPortfolio: Portfolio) => {
      repo.savePortfolio(nextPortfolio);
      repo.appendTrade(trade);
      setPortfolioState(nextPortfolio);
      setTrades((prev) => [trade, ...prev]);
    },
    [repo]
  );

  const addWatchlist = React.useCallback(
    (item: WatchlistItem) => {
      setWatchlist((prev) => {
        if (prev.some((x) => x.symbol === item.symbol)) return prev;
        const next = [...prev, item];
        repo.setWatchlist(next);
        return next;
      });
    },
    [repo]
  );

  const removeWatchlist = React.useCallback(
    (symbol: string) => {
      setWatchlist((prev) => {
        const next = prev.filter((x) => x.symbol !== symbol);
        repo.setWatchlist(next);
        return next;
      });
    },
    [repo]
  );

  const resetAll = React.useCallback(() => {
    repo.resetAll();
    setPortfolioState(repo.loadPortfolio());
    setTrades(repo.listTrades());
    setWatchlist(repo.getWatchlist());
  }, [repo]);

  const value = React.useMemo<PortfolioContextValue>(
    () => ({
      hydrated,
      portfolio,
      trades,
      watchlist,
      setPortfolio,
      recordTrade,
      addWatchlist,
      removeWatchlist,
      resetAll,
    }),
    [
      hydrated,
      portfolio,
      trades,
      watchlist,
      setPortfolio,
      recordTrade,
      addWatchlist,
      removeWatchlist,
      resetAll,
    ]
  );

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = React.useContext(PortfolioContext);
  if (!ctx) {
    throw new Error("usePortfolio must be used within PortfolioProvider");
  }
  return ctx;
}
