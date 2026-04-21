# AI Trading Simulator

Paper-trade real market quotes with virtual cash and get AI-generated trade opinions. Built with Next.js 15, TypeScript, Tailwind + shadcn/ui, and the Vercel AI SDK (OpenAI). Uses Yahoo Finance for live market data by default (no API key required), with an Alpha Vantage adapter as a drop-in alternative.

> Educational only — not financial advice.

## Features

- Customizable watchlist with auto-refreshing quotes (stocks + FX)
- Buy / sell simulated trades with a virtual $100,000 starting balance
- Portfolio with live P&L and full trade history
- On-demand AI opinion per trade or asset (thesis, risks, confidence, disclaimer)
- Graceful handling of rate-limit / stale quotes
- localStorage persistence behind a swappable repository interface

## Tech

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui primitives
- Vercel AI SDK + OpenAI (`generateObject` with zod schema)
- Market-data adapters (server-only, with TTL cache and fallback-on-stale):
  - **Yahoo Finance** (default, no API key) — real-time prices + day change for stocks, ETFs, indices, and FX
  - **Alpha Vantage** (optional, requires a free key)

## Getting started

```bash
cp .env.example .env.local
# OPENAI_API_KEY is required (for AI opinions)
# Market data works out-of-the-box via Yahoo; no key needed.

npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Key | Required | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | Used server-side only |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini` |
| `MARKET_DATA_PROVIDER` | no | `yahoo` (default, no key) or `alpha-vantage` |
| `ALPHA_VANTAGE_API_KEY` | only if using Alpha Vantage | Free tier works; expect rate-limits |

Secrets are only read inside Route Handlers and server modules — they never enter the client bundle.

## Architecture notes

- All OpenAI calls go through `app/api/ai/opinion/route.ts`.
- All market-data calls go through `app/api/quotes/route.ts` and `app/api/search/route.ts`.
- Provider logic lives behind `lib/market-data/provider.ts` + adapters in `lib/market-data/adapters/*`. The active provider is selected at runtime via `MARKET_DATA_PROVIDER`. Swapping to Polygon / Twelve Data / IEX is a new adapter file + one branch in `getAdapter()`; UI and trading code stay untouched.
- Portfolio + trades + watchlist persist to `localStorage` via `lib/persistence/localStorageRepo.ts` (implements `PortfolioRepo`). You can add a server-JSON implementation without changing UI code.

## Tests

```bash
npm test
```

Covers the trading engine math and both market-data adapters (Yahoo + Alpha Vantage) for stock, FX, and search normalization.
# Trading-Platform-for-Women
