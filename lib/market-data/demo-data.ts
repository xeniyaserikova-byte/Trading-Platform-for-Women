import type { HistoricalPoint, HistoricalSeries, Quote } from "@/lib/types";

/**
 * A hand-curated snapshot used ONLY when every live provider is unavailable
 * (AV daily quota exhausted AND Yahoo IP-throttled). Every quote returned
 * from here is tagged `source: "demo"` so the UI can surface a clear
 * "demo data" banner.
 *
 * Prices approximate late-April 2026 levels from the conversation's working
 * context so the Market Summary page is demonstrable without a live feed.
 */
interface DemoSeed {
  price: number;
  changePct: number;
  currency?: string;
  assetClass?: "stock" | "fx";
}

const DEMO_SEEDS: Record<string, DemoSeed> = {
  AAPL: { price: 228.14, changePct: 0.36 },
  MSFT: { price: 492.88, changePct: -0.21 },
  TSLA: { price: 267.41, changePct: 1.12 },
  GOOGL: { price: 181.73, changePct: 0.45 },
  AMZN: { price: 215.04, changePct: -0.38 },
  META: { price: 586.29, changePct: 0.22 },
  NVDA: { price: 138.67, changePct: 1.58 },
  SPY: { price: 708.72, changePct: -0.24 },
  QQQ: { price: 656.4, changePct: -0.31 },
  DIA: { price: 482.15, changePct: -0.14 },
  IWM: { price: 255.31, changePct: 0.42 },
  EFA: { price: 92.14, changePct: 0.18 },
  EWJ: { price: 83.92, changePct: 0.89 },
  VGK: { price: 78.61, changePct: -0.3 },
  IBIT: { price: 54.71, changePct: 0.17 },
  ETHA: { price: 27.42, changePct: -0.33 },
  FBTC: { price: 117.28, changePct: 0.21 },
  BITB: { price: 69.14, changePct: 0.09 },
  UUP: { price: 28.47, changePct: -1.04 },
  GLD: { price: 443.55, changePct: -0.59 },
  USO: { price: 78.31, changePct: -0.27 },
  UNG: { price: 12.06, changePct: -0.22 },
  TLT: { price: 84.22, changePct: 0.32 },
  "EUR/USD": { price: 1.092, changePct: -0.14, currency: "USD", assetClass: "fx" },
  "GBP/USD": { price: 1.278, changePct: -0.08, currency: "USD", assetClass: "fx" },
  "USD/JPY": { price: 151.4, changePct: 0.24, currency: "JPY", assetClass: "fx" },
};

export function hasDemoSeed(symbol: string): boolean {
  return symbol in DEMO_SEEDS;
}

export function buildDemoQuote(symbol: string): Quote | undefined {
  const seed = DEMO_SEEDS[symbol];
  if (!seed) return undefined;
  const prev = seed.price / (1 + seed.changePct / 100);
  const change = seed.price - prev;
  return {
    symbol,
    assetClass: seed.assetClass ?? "stock",
    price: round(seed.price, 4),
    change: round(change, 4),
    changePct: seed.changePct,
    asOf: new Date().toISOString(),
    currency: seed.currency ?? "USD",
    stale: false,
    source: "demo",
    note: "Demo data — live providers unavailable",
  };
}

/**
 * Generate a plausible 30-day close history by walking backwards from the
 * current price with a mild random-walk seeded on the symbol (so the chart
 * stays stable between refreshes).
 */
export function buildDemoHistory(
  symbol: string,
  days: number
): HistoricalSeries | undefined {
  const seed = DEMO_SEEDS[symbol];
  if (!seed) return undefined;
  const points = generateWalk(symbol, seed.price, days);
  return {
    symbol,
    points,
    source: "demo",
    stale: false,
  };
}

function generateWalk(
  symbol: string,
  endPrice: number,
  days: number
): HistoricalPoint[] {
  const rng = mulberry32(hashString(symbol));
  const volatility = 0.012; // ~1.2% daily volatility — feels like a real index
  const closes: number[] = new Array(days).fill(0);
  closes[days - 1] = endPrice;
  for (let i = days - 2; i >= 0; i--) {
    const shock = (rng() * 2 - 1) * volatility;
    closes[i] = closes[i + 1] / (1 + shock);
  }
  const now = new Date();
  const points: HistoricalPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    points.push({
      date: d.toISOString().slice(0, 10),
      close: round(closes[i], 4),
    });
  }
  return points;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(n: number, digits: number): number {
  const k = Math.pow(10, digits);
  return Math.round(n * k) / k;
}
