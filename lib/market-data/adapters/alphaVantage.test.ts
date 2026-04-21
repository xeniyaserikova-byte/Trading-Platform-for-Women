import { describe, it, expect } from "vitest";
import {
  createAlphaVantageAdapter,
  normalizeFx,
  normalizeSearch,
  normalizeStock,
} from "./alphaVantage";
import { MarketDataError } from "../types";

describe("normalizeStock", () => {
  it("parses a GLOBAL_QUOTE payload", () => {
    const q = normalizeStock(
      {
        "Global Quote": {
          "01. symbol": "AAPL",
          "05. price": "185.12",
          "09. change": "1.20",
          "10. change percent": "0.65%",
          "07. latest trading day": "2024-01-02",
        },
      },
      "AAPL"
    );
    expect(q.symbol).toBe("AAPL");
    expect(q.assetClass).toBe("stock");
    expect(q.price).toBeCloseTo(185.12);
    expect(q.change).toBeCloseTo(1.2);
    expect(q.changePct).toBeCloseTo(0.65);
    expect(q.stale).toBe(false);
    expect(q.source).toBe("alpha-vantage");
  });

  it("throws when Global Quote is missing", () => {
    expect(() => normalizeStock({ "Global Quote": {} }, "AAPL")).toThrow(
      MarketDataError
    );
  });
});

describe("normalizeFx", () => {
  it("parses a CURRENCY_EXCHANGE_RATE payload", () => {
    const q = normalizeFx(
      {
        "Realtime Currency Exchange Rate": {
          "1. From_Currency Code": "EUR",
          "3. To_Currency Code": "USD",
          "5. Exchange Rate": "1.0812",
          "6. Last Refreshed": "2024-01-02 15:30:00",
        },
      },
      "EUR/USD"
    );
    expect(q.assetClass).toBe("fx");
    expect(q.price).toBeCloseTo(1.0812, 4);
    expect(q.currency).toBe("USD");
    expect(q.change).toBe(0);
    expect(q.changePct).toBe(0);
  });
});

describe("normalizeSearch", () => {
  it("maps bestMatches to Instrument[]", () => {
    const list = normalizeSearch({
      bestMatches: [
        {
          "1. symbol": "TSLA",
          "2. name": "Tesla Inc",
          "4. region": "United States",
          "8. currency": "USD",
        },
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      symbol: "TSLA",
      name: "Tesla Inc",
      assetClass: "stock",
      region: "United States",
    });
  });

  it("returns [] when no matches", () => {
    expect(normalizeSearch({})).toEqual([]);
  });
});

describe("adapter (fetch plumbing)", () => {
  it("raises rate_limited when Note is present", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(
        JSON.stringify({ Note: "API call frequency exceeded" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    const adapter = createAlphaVantageAdapter({
      apiKey: "key",
      fetchImpl: fetchMock,
    });
    await expect(adapter.getQuote("AAPL")).rejects.toMatchObject({
      code: "rate_limited",
    });
  });

  it("dispatches FX requests for currency-looking symbols", async () => {
    let calledUrl = "";
    const fetchMock: typeof fetch = async (url) => {
      calledUrl = String(url);
      return new Response(
        JSON.stringify({
          "Realtime Currency Exchange Rate": {
            "1. From_Currency Code": "EUR",
            "3. To_Currency Code": "USD",
            "5. Exchange Rate": "1.10",
            "6. Last Refreshed": "2024-01-02 15:30:00",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const adapter = createAlphaVantageAdapter({
      apiKey: "key",
      fetchImpl: fetchMock,
    });
    const q = await adapter.getQuote("EUR/USD");
    expect(calledUrl).toContain("function=CURRENCY_EXCHANGE_RATE");
    expect(q.assetClass).toBe("fx");
    expect(q.price).toBeCloseTo(1.1);
  });

  it("dispatches GLOBAL_QUOTE for stock-looking symbols", async () => {
    let calledUrl = "";
    const fetchMock: typeof fetch = async (url) => {
      calledUrl = String(url);
      return new Response(
        JSON.stringify({
          "Global Quote": {
            "01. symbol": "MSFT",
            "05. price": "400.00",
            "09. change": "0",
            "10. change percent": "0%",
            "07. latest trading day": "2024-01-02",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const adapter = createAlphaVantageAdapter({
      apiKey: "key",
      fetchImpl: fetchMock,
    });
    const q = await adapter.getQuote("MSFT");
    expect(calledUrl).toContain("function=GLOBAL_QUOTE");
    expect(q.price).toBe(400);
  });
});
