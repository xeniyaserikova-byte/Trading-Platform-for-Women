import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

export const WAVICK_DISCLAIMER =
  "Wavick trades virtual capital in a simulator. Educational only. Not financial advice.";

export const WavickMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const WavickContextSchema = z.object({
  cash: z.number().nonnegative(),
  baseCurrency: z.string().min(1).max(8),
  totalEquity: z.number().nonnegative(),
  unrealizedPnL: z.number(),
  positions: z.array(
    z.object({
      symbol: z.string(),
      qty: z.number(),
      avgCost: z.number(),
      assetClass: z.enum(["stock", "fx"]),
      lastPrice: z.number().optional(),
    })
  ),
  watchlist: z.array(
    z.object({
      symbol: z.string(),
      name: z.string().optional(),
      assetClass: z.enum(["stock", "fx"]),
      lastPrice: z.number().optional(),
      changePct: z.number().optional(),
    })
  ),
  hintedSymbol: z.string().optional(),
});

export const WavickInputSchema = z.object({
  messages: z.array(WavickMessageSchema).min(0).max(40),
  context: WavickContextSchema,
});

export type WavickInput = z.infer<typeof WavickInputSchema>;

export const ProposedTradeSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(16)
    .describe("Ticker exactly as it appears in the user's watchlist or a valid US equity symbol like AAPL. FX pairs use the 'EUR/USD' format."),
  side: z.enum(["buy", "sell"]),
  qty: z
    .number()
    .positive()
    .max(1_000_000)
    .describe(
      "Quantity. Integer shares for equities; decimals allowed but discouraged."
    ),
  reason: z
    .string()
    .min(3)
    .max(220)
    .describe("One concise sentence explaining why this trade fits the user's strategy."),
});

export const WavickOutputSchema = z.object({
  message: z
    .string()
    .min(1)
    .max(1200)
    .describe(
      "Your conversational reply to the user. Do NOT list proposed trades here — put those in the proposedTrades field. Speak in a calm, editorial tone."
    ),
  proposedTrades: z
    .array(ProposedTradeSchema)
    .max(10)
    .describe(
      "Only populate when you're confident enough to propose concrete trades. Leave empty while still learning the user's strategy."
    ),
  awaitingInfo: z
    .boolean()
    .describe(
      "True if you still need more information from the user before proposing trades. False once you've proposed a plan or are discussing results."
    ),
});

export type WavickOutput = z.infer<typeof WavickOutputSchema>;

const SYSTEM_PROMPT = [
  "You are Wavick, an AI trading companion inside a paper-trading simulator.",
  "The user operates with virtual capital. Everything is educational; nothing is financial advice.",
  "",
  "YOUR METHOD:",
  "1. If you don't yet understand the user's strategy, ask 1-2 concise questions at a time. Cover: risk tolerance (low/med/high), time horizon (days/weeks/months/years), sectors or themes they like, how much of their cash they want to deploy this session, and whether they prefer blue-chip stability or aggressive growth.",
  "2. Once you have enough to build a thesis, propose a concrete set of trades. Size each trade from the user's ACTUAL cash — never exceed it in aggregate. Prefer symbols on the user's watchlist; if you introduce a new ticker, it must be a real, well-known US-listed name.",
  "3. Never propose selling a position the user doesn't hold.",
  "4. Never propose buying more than the cash available. If you're proposing multiple buys, their total notional must fit within cash.",
  "5. Quantities should be whole integers for stocks unless the user asked otherwise.",
  "6. Once trades execute, the user may ask you to review, rebalance, or continue. Respond conversationally.",
  "",
  "STYLE:",
  "- Editorial and concise. Short paragraphs. No hype, no emoji, no exclamation points.",
  "- Name stocks by ticker. Name FX pairs as EUR/USD.",
  "- Be decisive. Avoid waffling.",
  "- Never output prices — the simulator already shows them.",
  "",
  "OUTPUT RULES:",
  "- Put your message to the user in `message`.",
  "- Put any proposed trades in `proposedTrades` (structured). NEVER list them in `message` prose.",
  "- Set `awaitingInfo` to true while you're still interviewing; false once you've proposed trades or are chatting post-execution.",
].join("\n");

export async function generateWavickReply(
  input: WavickInput
): Promise<WavickOutput> {
  const model = openai(process.env.OPENAI_MODEL || "gpt-4o-mini");

  const { object } = await generateObject({
    model,
    schema: WavickOutputSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(input),
    temperature: 0.4,
  });

  return normalizeOutput(object, input);
}

function buildPrompt(input: WavickInput): string {
  const { messages, context } = input;
  const ctx = renderContext(context);
  const convo = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
  const parts = [
    "## PORTFOLIO CONTEXT",
    ctx,
    "",
    "## CONVERSATION SO FAR",
    convo || "(no messages yet — this is the opening turn; greet the user briefly and start interviewing them about their strategy)",
  ];
  if (context.hintedSymbol) {
    parts.push(
      "",
      `## HINT`,
      `The user opened this conversation from the ${context.hintedSymbol} page. Keep that in mind when interviewing or proposing.`
    );
  }
  return parts.join("\n");
}

function renderContext(ctx: WavickInput["context"]): string {
  const lines: string[] = [];
  lines.push(
    `Cash available: ${ctx.cash.toFixed(2)} ${ctx.baseCurrency}`
  );
  lines.push(`Total equity: ${ctx.totalEquity.toFixed(2)} ${ctx.baseCurrency}`);
  lines.push(
    `Unrealized P&L: ${ctx.unrealizedPnL >= 0 ? "+" : ""}${ctx.unrealizedPnL.toFixed(2)}`
  );
  if (ctx.positions.length === 0) {
    lines.push("Positions: none");
  } else {
    lines.push("Positions:");
    for (const p of ctx.positions) {
      const mkt = p.lastPrice != null ? ` — last ${p.lastPrice}` : "";
      lines.push(
        `  - ${p.symbol} (${p.assetClass}) qty ${p.qty} @ avg ${p.avgCost}${mkt}`
      );
    }
  }
  if (ctx.watchlist.length > 0) {
    lines.push("Watchlist:");
    for (const w of ctx.watchlist) {
      const pc =
        w.changePct != null
          ? ` (${w.changePct >= 0 ? "+" : ""}${w.changePct.toFixed(2)}%)`
          : "";
      const pr = w.lastPrice != null ? ` @ ${w.lastPrice}` : "";
      lines.push(
        `  - ${w.symbol}${w.name ? ` — ${w.name}` : ""}${pr}${pc}`
      );
    }
  }
  return lines.join("\n");
}

function normalizeOutput(
  out: WavickOutput,
  input: WavickInput
): WavickOutput {
  // Guardrail: if any proposed sells reference symbols the user doesn't hold,
  // drop them. This is a safety net — the model is instructed not to do this.
  const ownedSymbols = new Set(input.context.positions.map((p) => p.symbol));
  const cash = input.context.cash;

  const safe = out.proposedTrades.filter((t) => {
    if (t.side === "sell" && !ownedSymbols.has(t.symbol)) return false;
    return true;
  });

  // Drop buys that would exceed available cash based on last known prices.
  const priceBySymbol = new Map<string, number>();
  for (const w of input.context.watchlist) {
    if (w.lastPrice != null) priceBySymbol.set(w.symbol, w.lastPrice);
  }
  for (const p of input.context.positions) {
    if (p.lastPrice != null) priceBySymbol.set(p.symbol, p.lastPrice);
  }

  let projected = 0;
  const trimmed: typeof safe = [];
  for (const t of safe) {
    if (t.side === "buy") {
      const est = (priceBySymbol.get(t.symbol) ?? 0) * t.qty;
      if (est > 0 && projected + est > cash) continue;
      projected += est;
    }
    trimmed.push(t);
  }

  return {
    message: out.message,
    proposedTrades: trimmed,
    awaitingInfo:
      trimmed.length > 0 ? false : out.awaitingInfo,
  };
}
