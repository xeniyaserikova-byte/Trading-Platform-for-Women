export type AssetClass = "stock" | "fx";

export type TradeSide = "buy" | "sell";

export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency?: string;
  region?: string;
}

export interface Quote {
  symbol: string;
  assetClass: AssetClass;
  price: number;
  change: number;
  changePct: number;
  asOf: string;
  currency: string;
  stale: boolean;
  source: string;
  note?: string;
}

export interface Position {
  symbol: string;
  assetClass: AssetClass;
  qty: number;
  avgCost: number;
}

export interface Portfolio {
  cash: number;
  baseCurrency: string;
  positions: Position[];
}

export interface Trade {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  side: TradeSide;
  qty: number;
  price: number;
  notional: number;
  timestamp: string;
}

export interface PortfolioSnapshot {
  cash: number;
  positionsValue: number;
  totalEquity: number;
  unrealizedPnL: number;
  baseCurrency: string;
}

export interface HistoricalPoint {
  date: string; // ISO date (YYYY-MM-DD)
  close: number;
}

export interface HistoricalSeries {
  symbol: string;
  points: HistoricalPoint[];
  source: string;
  stale: boolean;
}
