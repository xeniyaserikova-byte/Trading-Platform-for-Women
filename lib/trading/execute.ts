import type {
  Portfolio,
  PortfolioSnapshot,
  Position,
  Quote,
  Trade,
  TradeSide,
} from "@/lib/types";

const EPSILON = 1e-9;

export class TradeValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_qty"
      | "invalid_price"
      | "insufficient_cash"
      | "insufficient_shares"
      | "stale_quote"
  ) {
    super(message);
    this.name = "TradeValidationError";
  }
}

export interface ExecuteInput {
  portfolio: Portfolio;
  quote: Quote;
  side: TradeSide;
  qty: number;
}

export interface ExecuteResult {
  portfolio: Portfolio;
  trade: Trade;
}

export function validateQty(qty: number) {
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new TradeValidationError("Quantity must be a positive number", "invalid_qty");
  }
}

export function canAfford(
  portfolio: Portfolio,
  quote: Quote,
  qty: number
): boolean {
  return portfolio.cash + EPSILON >= quote.price * qty;
}

export function findPosition(
  portfolio: Portfolio,
  symbol: string
): Position | undefined {
  return portfolio.positions.find((p) => p.symbol === symbol);
}

export function applyBuy(
  portfolio: Portfolio,
  quote: Quote,
  qty: number
): Portfolio {
  validateQty(qty);
  if (!(quote.price > 0)) {
    throw new TradeValidationError("Quote price must be positive", "invalid_price");
  }
  const cost = quote.price * qty;
  if (!canAfford(portfolio, quote, qty)) {
    throw new TradeValidationError(
      "Insufficient cash for this buy",
      "insufficient_cash"
    );
  }
  const existing = findPosition(portfolio, quote.symbol);
  let nextPositions: Position[];
  if (existing) {
    const newQty = existing.qty + qty;
    const newAvg = (existing.avgCost * existing.qty + quote.price * qty) / newQty;
    nextPositions = portfolio.positions.map((p) =>
      p.symbol === quote.symbol ? { ...p, qty: newQty, avgCost: newAvg } : p
    );
  } else {
    nextPositions = [
      ...portfolio.positions,
      {
        symbol: quote.symbol,
        assetClass: quote.assetClass,
        qty,
        avgCost: quote.price,
      },
    ];
  }
  return {
    ...portfolio,
    cash: round2(portfolio.cash - cost),
    positions: nextPositions,
  };
}

export function applySell(
  portfolio: Portfolio,
  quote: Quote,
  qty: number
): Portfolio {
  validateQty(qty);
  if (!(quote.price > 0)) {
    throw new TradeValidationError("Quote price must be positive", "invalid_price");
  }
  const existing = findPosition(portfolio, quote.symbol);
  if (!existing || existing.qty + EPSILON < qty) {
    throw new TradeValidationError(
      "Insufficient shares for this sell (no shorting in v1)",
      "insufficient_shares"
    );
  }
  const proceeds = quote.price * qty;
  const remaining = existing.qty - qty;
  const nextPositions: Position[] =
    remaining <= EPSILON
      ? portfolio.positions.filter((p) => p.symbol !== quote.symbol)
      : portfolio.positions.map((p) =>
          p.symbol === quote.symbol ? { ...p, qty: remaining } : p
        );
  return {
    ...portfolio,
    cash: round2(portfolio.cash + proceeds),
    positions: nextPositions,
  };
}

export function executeTrade(input: ExecuteInput): ExecuteResult {
  const { portfolio, quote, side, qty } = input;
  const nextPortfolio =
    side === "buy"
      ? applyBuy(portfolio, quote, qty)
      : applySell(portfolio, quote, qty);

  const trade: Trade = {
    id: newTradeId(),
    symbol: quote.symbol,
    assetClass: quote.assetClass,
    side,
    qty,
    price: quote.price,
    notional: round2(quote.price * qty),
    timestamp: new Date().toISOString(),
  };
  return { portfolio: nextPortfolio, trade };
}

export function positionsValue(
  positions: Position[],
  quotesBySymbol: Record<string, Quote>
): number {
  return positions.reduce((sum, p) => {
    const q = quotesBySymbol[p.symbol];
    if (!q) return sum + p.avgCost * p.qty;
    return sum + q.price * p.qty;
  }, 0);
}

export function unrealizedPnL(
  positions: Position[],
  quotesBySymbol: Record<string, Quote>
): number {
  return positions.reduce((sum, p) => {
    const q = quotesBySymbol[p.symbol];
    if (!q) return sum;
    return sum + (q.price - p.avgCost) * p.qty;
  }, 0);
}

export function portfolioSnapshot(
  portfolio: Portfolio,
  quotesBySymbol: Record<string, Quote>
): PortfolioSnapshot {
  const positionsVal = positionsValue(portfolio.positions, quotesBySymbol);
  return {
    cash: portfolio.cash,
    positionsValue: round2(positionsVal),
    totalEquity: round2(portfolio.cash + positionsVal),
    unrealizedPnL: round2(unrealizedPnL(portfolio.positions, quotesBySymbol)),
    baseCurrency: portfolio.baseCurrency,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function newTradeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
