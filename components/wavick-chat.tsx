"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Loader2,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { usePortfolio } from "@/components/providers/portfolio-provider";
import { useQuotes } from "@/hooks/use-quotes";
import {
  executeTrade,
  portfolioSnapshot,
  TradeValidationError,
} from "@/lib/trading/execute";
import type { Portfolio, Quote, Trade } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  proposedTrades?: ProposedTrade[];
  tradeResults?: TradeResult[];
  timestamp: string;
}

interface ProposedTrade {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  reason: string;
}

interface TradeResult {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  ok: boolean;
  price?: number;
  notional?: number;
  error?: string;
}

interface WavickChatProps {
  hintedSymbol?: string;
}

export function WavickChat({ hintedSymbol }: WavickChatProps) {
  const { portfolio, trades, watchlist, recordTrade, hydrated } =
    usePortfolio();

  // Fetch quotes for union of watchlist + position symbols so Wavick has
  // real prices to reason over, and so we can validate proposed trades.
  const symbols = React.useMemo(() => {
    const set = new Set<string>();
    for (const w of watchlist) set.add(w.symbol);
    for (const p of portfolio.positions) set.add(p.symbol);
    if (hintedSymbol) set.add(hintedSymbol);
    return Array.from(set);
  }, [watchlist, portfolio.positions, hintedSymbol]);
  const { quotes } = useQuotes(symbols, 60_000);

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [openedOnce, setOpenedOnce] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const snap = portfolioSnapshot(portfolio, quotes);

  const sendMessage = React.useCallback(
    async (userText: string | null) => {
      if (sending) return;
      if (!hydrated) return;

      const outgoing: ChatMessage[] = userText
        ? [
            ...messages,
            {
              id: cryptoId(),
              role: "user",
              content: userText,
              timestamp: new Date().toISOString(),
            },
          ]
        : messages;

      if (userText) setMessages(outgoing);
      setInput("");
      setSending(true);

      try {
        const context = buildContext(portfolio, quotes, watchlist, hintedSymbol);
        const historyForAI = outgoing
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }));
        const res = await fetch("/api/ai/wavick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForAI, context }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? `HTTP ${res.status}`);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: cryptoId(),
            role: "assistant",
            content: String(json.message ?? ""),
            proposedTrades: Array.isArray(json.proposedTrades)
              ? (json.proposedTrades as ProposedTrade[])
              : [],
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        toast.error("Wavick is unavailable", { description: msg });
        setMessages((prev) => [
          ...prev,
          {
            id: cryptoId(),
            role: "system",
            content: msg,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [sending, hydrated, messages, portfolio, quotes, watchlist, hintedSymbol]
  );

  // Auto-kick the conversation on mount so Wavick opens with a greeting /
  // first interview question.
  React.useEffect(() => {
    if (!hydrated || openedOnce || messages.length > 0) return;
    setOpenedOnce(true);
    void sendMessage(null);
  }, [hydrated, openedOnce, messages.length, sendMessage]);

  // Keep the scroll pinned to the latest message.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function executePlan(
    messageId: string,
    proposed: ProposedTrade[]
  ): Promise<void> {
    if (proposed.length === 0) return;

    // Use the latest quotes we have; refuse trades with no known price
    // or with a stale quote older than 10 minutes.
    const tradeSymbols = Array.from(new Set(proposed.map((t) => t.symbol)));
    let freshQuotes: Record<string, Quote> = { ...quotes };
    try {
      const res = await fetch(
        `/api/quotes?symbols=${encodeURIComponent(tradeSymbols.join(","))}`
      );
      const json = await res.json();
      if (res.ok && Array.isArray(json.quotes)) {
        for (const q of json.quotes as Quote[]) freshQuotes[q.symbol] = q;
      }
    } catch {
      // fall back to whatever we have
    }

    // Apply serially on a running portfolio to avoid order-dependent bugs.
    let runningPortfolio: Portfolio = portfolio;
    const runs: { trade: Trade; portfolio: Portfolio }[] = [];
    const results: TradeResult[] = [];

    for (const t of proposed) {
      const q = freshQuotes[t.symbol];
      if (!q) {
        results.push({
          ...t,
          ok: false,
          error: "No current quote available",
        });
        continue;
      }
      if (q.stale) {
        results.push({
          ...t,
          ok: false,
          error: "Quote is stale — refresh and try again",
        });
        continue;
      }
      try {
        const r = executeTrade({
          portfolio: runningPortfolio,
          quote: q,
          side: t.side,
          qty: t.qty,
        });
        runningPortfolio = r.portfolio;
        runs.push(r);
        results.push({
          ...t,
          ok: true,
          price: r.trade.price,
          notional: r.trade.notional,
        });
      } catch (err) {
        const msg =
          err instanceof TradeValidationError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown error";
        results.push({ ...t, ok: false, error: msg });
      }
    }

    // Persist each successful trade.
    for (const run of runs) recordTrade(run.trade, run.portfolio);

    // Attach results to the assistant message and strip pending proposal.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, proposedTrades: undefined, tradeResults: results }
          : m
      )
    );

    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;
    if (ok > 0 && fail === 0) {
      toast.success(`Wavick executed ${ok} trade${ok > 1 ? "s" : ""}`);
    } else if (ok > 0 && fail > 0) {
      toast.warning(`Executed ${ok}, skipped ${fail}`);
    } else {
      toast.error("No trades could be executed");
    }

    // Continue the conversation: tell Wavick what happened.
    const recap = results
      .map((r) =>
        r.ok
          ? `Executed ${r.side.toUpperCase()} ${r.qty} ${r.symbol} @ ${r.price?.toFixed(2)} (notional ${r.notional?.toFixed(2)})`
          : `Skipped ${r.side.toUpperCase()} ${r.qty} ${r.symbol}: ${r.error}`
      )
      .join("\n");
    void sendMessage(
      `Execution report:\n${recap}\n\nPlease review and recommend next steps.`
    );
  }

  function declinePlan(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, proposedTrades: undefined } : m
      )
    );
    void sendMessage(
      "I'd like to pass on that plan. Reconsider and propose something different, or ask me more about what I want."
    );
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_280px]">
      <div className="flex min-h-[560px] flex-col">
        <div
          ref={scrollRef}
          className="flex-1 space-y-8 overflow-y-auto pb-8 pr-2"
          style={{ maxHeight: "calc(100vh - 320px)" }}
        >
          {messages.length === 0 && !sending && (
            <OpeningSkeleton />
          )}
          {messages.map((m) => (
            <MessageBlock
              key={m.id}
              message={m}
              cash={snap.cash}
              onExecute={(trades) => executePlan(m.id, trades)}
              onDecline={() => declinePlan(m.id)}
            />
          ))}
          {sending && <ThinkingRow />}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text) return;
            void sendMessage(text);
          }}
          className="mt-2 border-t border-ink/10 pt-4"
        >
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const text = input.trim();
                  if (text) void sendMessage(text);
                }
              }}
              rows={1}
              placeholder={
                sending
                  ? "Wavick is thinking…"
                  : "Answer Wavick, or ask for a fresh plan…"
              }
              disabled={sending}
              className="num min-h-[44px] flex-1 resize-none border-0 border-b border-ink/30 bg-transparent py-2 text-[15px] text-ink placeholder:text-ink-mute focus:border-salmon focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || input.trim().length === 0}
              className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-xs uppercase tracking-[0.22em] text-paper transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send <SendHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink-mute">
            Enter sends · Shift+Enter newline · {messages.filter((m) => m.role !== "system").length} turn
            {messages.filter((m) => m.role !== "system").length === 1 ? "" : "s"} · Wavick proposes, you approve.
          </p>
        </form>
      </div>

      <SideRail
        hydrated={hydrated}
        cash={snap.cash}
        totalEquity={snap.totalEquity}
        unrealizedPnL={snap.unrealizedPnL}
        positionsCount={portfolio.positions.length}
        watchlistCount={watchlist.length}
        tradeCount={trades.length}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Message rendering                                                          */
/* -------------------------------------------------------------------------- */

function MessageBlock({
  message,
  cash,
  onExecute,
  onDecline,
}: {
  message: ChatMessage;
  cash: number;
  onExecute: (trades: ProposedTrade[]) => void;
  onDecline: () => void;
}) {
  if (message.role === "system") {
    return (
      <div className="flex items-center gap-3 text-xs text-signal-down">
        <CircleAlert className="h-3.5 w-3.5" />
        <span>{message.content}</span>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-ink px-5 py-3 text-[15px] leading-relaxed text-paper">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <WavickAvatar />
        <div className="max-w-[80%] space-y-3">
          <div className="eyebrow text-ink-mute">Wavick</div>
          <div className="whitespace-pre-wrap font-display text-[17px] leading-relaxed text-ink md:text-[18px]">
            {message.content}
          </div>
        </div>
      </div>

      {message.proposedTrades && message.proposedTrades.length > 0 && (
        <ProposalCard
          trades={message.proposedTrades}
          cash={cash}
          onExecute={() => onExecute(message.proposedTrades!)}
          onDecline={onDecline}
        />
      )}

      {message.tradeResults && message.tradeResults.length > 0 && (
        <ResultsCard results={message.tradeResults} />
      )}
    </div>
  );
}

function ProposalCard({
  trades,
  cash,
  onExecute,
  onDecline,
}: {
  trades: ProposedTrade[];
  cash: number;
  onExecute: () => void;
  onDecline: () => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  return (
    <div className="ml-[52px] border border-ink/15 bg-paper-sub">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
        <div className="eyebrow">Proposed plan</div>
        <div className="num text-[11px] text-ink-mute">
          Cash on hand · {formatCurrency(cash)}
        </div>
      </div>
      <ul className="divide-y divide-ink/10">
        {trades.map((t, i) => (
          <li
            key={`${t.symbol}-${i}`}
            className="grid grid-cols-12 items-center gap-3 px-5 py-3"
          >
            <div className="col-span-1 num text-xs text-ink-mute">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="col-span-2">
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 text-[10px] uppercase tracking-[0.22em]",
                  t.side === "buy"
                    ? "bg-signal-up/15 text-signal-up"
                    : "bg-signal-down/15 text-signal-down"
                )}
              >
                {t.side}
              </span>
            </div>
            <div className="col-span-2 font-display text-lg font-medium leading-none">
              {t.symbol}
            </div>
            <div className="col-span-1 num text-sm text-ink">× {t.qty}</div>
            <div className="col-span-6 text-[13px] leading-snug text-ink-soft">
              {t.reason}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-ink/10 bg-paper px-5 py-3">
        <button
          type="button"
          onClick={onDecline}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.22em] text-ink-mute transition-colors hover:text-ink disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" /> Pass
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onExecute();
            } finally {
              setSubmitting(false);
            }
          }}
          className="inline-flex h-10 items-center gap-2 bg-ink px-5 text-xs uppercase tracking-[0.22em] text-paper transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Executing…
            </>
          ) : (
            <>
              Execute plan <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ResultsCard({ results }: { results: TradeResult[] }) {
  return (
    <div className="ml-[52px] border border-ink/15 bg-paper">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
        <div className="eyebrow">Execution report</div>
      </div>
      <ul className="divide-y divide-ink/10">
        {results.map((r, i) => (
          <li
            key={`${r.symbol}-${i}`}
            className="grid grid-cols-12 items-center gap-3 px-5 py-3 text-sm"
          >
            <div className="col-span-1">
              {r.ok ? (
                <Check className="h-4 w-4 text-signal-up" />
              ) : (
                <X className="h-4 w-4 text-signal-down" />
              )}
            </div>
            <div className="col-span-2 font-display text-base font-medium leading-none">
              {r.symbol}
            </div>
            <div className="col-span-1 text-[11px] uppercase tracking-[0.22em] text-ink-mute">
              {r.side}
            </div>
            <div className="col-span-1 num text-ink">× {r.qty}</div>
            <div className="col-span-7 text-[13px] text-ink-soft">
              {r.ok ? (
                <span className="num">
                  @ {r.price?.toFixed(2)} · notional {formatCurrency(r.notional ?? 0)}
                </span>
              ) : (
                <span className="text-signal-down">{r.error}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="flex items-start gap-3">
      <WavickAvatar />
      <div className="flex items-center gap-2 pt-2 text-ink-mute">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-salmon" />
        <span className="eyebrow">Wavick is thinking</span>
      </div>
    </div>
  );
}

function OpeningSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <WavickAvatar />
      <div className="space-y-2 pt-2">
        <div className="h-3 w-56 bg-ink/10" />
        <div className="h-3 w-72 bg-ink/10" />
      </div>
    </div>
  );
}

function WavickAvatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-ink/20 bg-paper">
      <Sparkles className="h-4 w-4 text-salmon" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Side rail with portfolio snapshot                                          */
/* -------------------------------------------------------------------------- */

function SideRail({
  hydrated,
  cash,
  totalEquity,
  unrealizedPnL,
  positionsCount,
  watchlistCount,
  tradeCount,
}: {
  hydrated: boolean;
  cash: number;
  totalEquity: number;
  unrealizedPnL: number;
  positionsCount: number;
  watchlistCount: number;
  tradeCount: number;
}) {
  return (
    <aside className="hidden flex-col gap-5 self-start border-l border-ink/10 pl-8 md:flex">
      <div className="eyebrow">Wavick's dashboard</div>
      <RailStat
        label="Cash on hand"
        value={hydrated ? formatCurrency(cash) : "—"}
        emphasis
      />
      <RailStat
        label="Total equity"
        value={hydrated ? formatCurrency(totalEquity) : "—"}
      />
      <RailStat
        label="Unrealized"
        value={
          hydrated
            ? `${unrealizedPnL >= 0 ? "+" : ""}${formatCurrency(unrealizedPnL)}`
            : "—"
        }
        tone={unrealizedPnL >= 0 ? "up" : "down"}
      />
      <div className="h-px w-full bg-ink/10" />
      <RailStat
        label="Open positions"
        value={hydrated ? String(positionsCount) : "—"}
      />
      <RailStat
        label="Watchlist"
        value={hydrated ? String(watchlistCount) : "—"}
      />
      <RailStat label="Trades filed" value={hydrated ? String(tradeCount) : "—"} />
      <p className="mt-4 text-[11px] leading-relaxed text-ink-mute">
        Wavick trades virtual capital against live quotes. Every plan requires
        your approval before execution. Not financial advice.
      </p>
    </aside>
  );
}

function RailStat({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "up" | "down";
}) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          "num mt-1",
          emphasis ? "font-display text-3xl text-ink" : "text-lg text-ink",
          tone === "up" && "text-signal-up",
          tone === "down" && "text-signal-down"
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildContext(
  portfolio: Portfolio,
  quotes: Record<string, Quote>,
  watchlist: { symbol: string; name?: string; assetClass: "stock" | "fx" }[],
  hintedSymbol?: string
) {
  const snap = portfolioSnapshot(portfolio, quotes);
  return {
    cash: snap.cash,
    baseCurrency: portfolio.baseCurrency,
    totalEquity: snap.totalEquity,
    unrealizedPnL: snap.unrealizedPnL,
    positions: portfolio.positions.map((p) => ({
      symbol: p.symbol,
      qty: p.qty,
      avgCost: p.avgCost,
      assetClass: p.assetClass,
      lastPrice: quotes[p.symbol]?.price,
    })),
    watchlist: watchlist.map((w) => ({
      symbol: w.symbol,
      name: w.name,
      assetClass: w.assetClass,
      lastPrice: quotes[w.symbol]?.price,
      changePct: quotes[w.symbol]?.changePct,
    })),
    hintedSymbol,
  };
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
