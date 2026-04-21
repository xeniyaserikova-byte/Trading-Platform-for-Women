import { describe, it, expect } from "vitest";
import type { Portfolio, Quote } from "@/lib/types";
import {
  applyBuy,
  applySell,
  executeTrade,
  portfolioSnapshot,
  TradeValidationError,
  unrealizedPnL,
} from "./execute";

function mkPortfolio(partial?: Partial<Portfolio>): Portfolio {
  return {
    cash: 100_000,
    baseCurrency: "USD",
    positions: [],
    ...partial,
  };
}

function mkQuote(overrides?: Partial<Quote>): Quote {
  return {
    symbol: "AAPL",
    assetClass: "stock",
    price: 100,
    change: 0,
    changePct: 0,
    asOf: new Date("2024-01-01T00:00:00Z").toISOString(),
    currency: "USD",
    stale: false,
    source: "test",
    ...overrides,
  };
}

describe("applyBuy", () => {
  it("creates a new position and deducts cash", () => {
    const p = applyBuy(mkPortfolio(), mkQuote({ price: 150 }), 10);
    expect(p.cash).toBe(98_500);
    expect(p.positions).toHaveLength(1);
    expect(p.positions[0]).toMatchObject({
      symbol: "AAPL",
      qty: 10,
      avgCost: 150,
    });
  });

  it("recomputes weighted average cost on add", () => {
    const first = applyBuy(mkPortfolio(), mkQuote({ price: 100 }), 10);
    const second = applyBuy(first, mkQuote({ price: 200 }), 10);
    expect(second.positions[0].qty).toBe(20);
    expect(second.positions[0].avgCost).toBeCloseTo(150, 5);
    expect(second.cash).toBe(100_000 - 1_000 - 2_000);
  });

  it("rejects buys that exceed available cash", () => {
    expect(() => applyBuy(mkPortfolio({ cash: 500 }), mkQuote({ price: 100 }), 10)).toThrow(
      TradeValidationError
    );
  });

  it("rejects non-positive qty", () => {
    expect(() => applyBuy(mkPortfolio(), mkQuote(), 0)).toThrow(
      TradeValidationError
    );
    expect(() => applyBuy(mkPortfolio(), mkQuote(), -1)).toThrow(
      TradeValidationError
    );
  });
});

describe("applySell", () => {
  it("reduces position and credits cash", () => {
    const withPos = applyBuy(mkPortfolio(), mkQuote({ price: 100 }), 10);
    const after = applySell(withPos, mkQuote({ price: 120 }), 4);
    expect(after.positions[0].qty).toBe(6);
    expect(after.positions[0].avgCost).toBe(100);
    expect(after.cash).toBe(100_000 - 1_000 + 480);
  });

  it("removes position when fully exited", () => {
    const withPos = applyBuy(mkPortfolio(), mkQuote({ price: 100 }), 10);
    const after = applySell(withPos, mkQuote({ price: 110 }), 10);
    expect(after.positions).toHaveLength(0);
    expect(after.cash).toBe(100_000 - 1_000 + 1_100);
  });

  it("rejects shorting (selling more than held)", () => {
    const withPos = applyBuy(mkPortfolio(), mkQuote({ price: 100 }), 5);
    expect(() => applySell(withPos, mkQuote({ price: 100 }), 10)).toThrow(
      TradeValidationError
    );
  });

  it("rejects selling an asset you don't hold", () => {
    expect(() => applySell(mkPortfolio(), mkQuote(), 1)).toThrow(
      TradeValidationError
    );
  });
});

describe("executeTrade", () => {
  it("returns a trade record with correct notional", () => {
    const { portfolio, trade } = executeTrade({
      portfolio: mkPortfolio(),
      quote: mkQuote({ price: 50 }),
      side: "buy",
      qty: 3,
    });
    expect(portfolio.cash).toBe(100_000 - 150);
    expect(trade.notional).toBe(150);
    expect(trade.side).toBe("buy");
    expect(trade.id).toBeTruthy();
  });
});

describe("P&L and snapshot", () => {
  it("computes unrealized P&L vs avg cost", () => {
    const p = applyBuy(mkPortfolio(), mkQuote({ price: 100 }), 10);
    const pnl = unrealizedPnL(p.positions, { AAPL: mkQuote({ price: 150 }) });
    expect(pnl).toBe(500);
  });

  it("portfolioSnapshot sums cash and positions", () => {
    const p = applyBuy(mkPortfolio(), mkQuote({ price: 100 }), 10);
    const snap = portfolioSnapshot(p, { AAPL: mkQuote({ price: 120 }) });
    expect(snap.cash).toBe(99_000);
    expect(snap.positionsValue).toBe(1_200);
    expect(snap.totalEquity).toBe(100_200);
    expect(snap.unrealizedPnL).toBe(200);
  });
});
