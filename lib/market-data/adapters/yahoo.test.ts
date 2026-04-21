import { describe, it, expect } from "vitest";
import {
  createYahooAdapter,
  normalizeMeta,
  normalizeSearch,
  toYahooSymbol,
} from "./yahoo";
import { MarketDataError } from "../types";

describe("toYahooSymbol", () => {
  it("passes stock tickers through", () => {
    expect(toYahooSymbol("AAPL", "stock")).toBe("AAPL");
    expect(toYahooSymbol("BRK-B", "stock")).toBe("BRK-B");
  });

  it("maps canonical FX to Yahoo form", () => {
    expect(toYahooSymbol("EUR/USD", "fx")).toBe("EURUSD=X");
    expect(toYahooSymbol("GBP/JPY", "fx")).toBe("GBPJPY=X");
  });
});

describe("normalizeMeta", () => {
  it("computes change and changePct for a stock", () => {
    const q = normalizeMeta(
      {
        currency: "USD",
        regularMarketPrice: 110,
        chartPreviousClose: 100,
        regularMarketTime: 1_700_000_000,
        shortName: "Test Co.",
      },
      "TST",
      "stock"
    );
    expect(q.symbol).toBe("TST");
    expect(q.assetClass).toBe("stock");
    expect(q.price).toBe(110);
    expect(q.change).toBeCloseTo(10);
    expect(q.changePct).toBeCloseTo(10);
    expect(q.currency).toBe("USD");
    expect(q.source).toBe("yahoo");
    expect(q.stale).toBe(false);
  });

  it("handles FX with real change data", () => {
    const q = normalizeMeta(
      {
        currency: "USD",
        regularMarketPrice: 1.08,
        chartPreviousClose: 1.1,
      },
      "EUR/USD",
      "fx"
    );
    expect(q.assetClass).toBe("fx");
    expect(q.price).toBeCloseTo(1.08);
    expect(q.change).toBeCloseTo(-0.02, 3);
    expect(q.changePct).toBeLessThan(0);
  });
});

describe("normalizeSearch", () => {
  it("maps equity and currency hits to canonical Instrument[]", () => {
    const list = normalizeSearch({
      quotes: [
        {
          symbol: "TSLA",
          longname: "Tesla, Inc.",
          quoteType: "EQUITY",
          exchDisp: "NASDAQ",
        },
        {
          symbol: "EURUSD=X",
          shortname: "EUR/USD",
          quoteType: "CURRENCY",
        },
        {
          symbol: "SOMETHING-ELSE",
          quoteType: "FUTURE",
        },
      ],
    });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ symbol: "TSLA", assetClass: "stock" });
    expect(list[1]).toMatchObject({ symbol: "EUR/USD", assetClass: "fx" });
  });
});

describe("adapter plumbing", () => {
  it("routes FX symbols to the =X Yahoo form", async () => {
    let calledUrl = "";
    const fetchMock: typeof fetch = async (url) => {
      calledUrl = String(url);
      return new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  currency: "USD",
                  regularMarketPrice: 1.1,
                  chartPreviousClose: 1.09,
                  regularMarketTime: 1_700_000_000,
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const adapter = createYahooAdapter({ fetchImpl: fetchMock });
    const q = await adapter.getQuote("EUR/USD");
    expect(calledUrl).toContain("EURUSD%3DX");
    expect(q.assetClass).toBe("fx");
    expect(q.symbol).toBe("EUR/USD");
    expect(q.price).toBeCloseTo(1.1);
  });

  it("throws not_found when meta is missing", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(JSON.stringify({ chart: { result: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const adapter = createYahooAdapter({ fetchImpl: fetchMock });
    await expect(adapter.getQuote("UNKNOWN")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("maps 429 to rate_limited", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response("", { status: 429 });
    const adapter = createYahooAdapter({ fetchImpl: fetchMock });
    await expect(adapter.getQuote("AAPL")).rejects.toBeInstanceOf(
      MarketDataError
    );
    await expect(adapter.getQuote("AAPL")).rejects.toMatchObject({
      code: "rate_limited",
    });
  });
});
