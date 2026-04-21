"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/components/providers/portfolio-provider";
import { useSound } from "@/components/providers/sound-provider";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  executeTrade,
  findPosition,
  TradeValidationError,
} from "@/lib/trading/execute";
import type { Quote, TradeSide } from "@/lib/types";

interface TradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | undefined;
  symbol: string;
  defaultSide?: TradeSide;
}

export function TradeDialog({
  open,
  onOpenChange,
  quote,
  symbol,
  defaultSide = "buy",
}: TradeDialogProps) {
  const { portfolio, recordTrade } = usePortfolio();
  const { play } = useSound();
  const [side, setSide] = React.useState<TradeSide>(defaultSide);
  const [qtyStr, setQtyStr] = React.useState("1");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSide(defaultSide);
      setQtyStr("1");
    }
  }, [open, defaultSide]);

  const qty = Number(qtyStr);
  const position = findPosition(portfolio, symbol);

  const canTrade = !!quote && quote.price > 0 && Number.isFinite(qty) && qty > 0;
  const notional = canTrade ? quote!.price * qty : 0;
  const insufficientCash =
    side === "buy" && canTrade && notional > portfolio.cash + 1e-9;
  const insufficientShares =
    side === "sell" && canTrade && (!position || position.qty + 1e-9 < qty);

  const handleSubmit = async () => {
    if (!quote || !canTrade) return;
    setSubmitting(true);
    try {
      const { portfolio: next, trade } = executeTrade({
        portfolio,
        quote,
        side,
        qty,
      });
      recordTrade(trade, next);
      play(side === "buy" ? "coin" : "success");
      toast.success(
        `${side === "buy" ? "Bought" : "Sold"} ${qty} ${quote.symbol} @ ${formatNumber(quote.price, 4)}`
      );
      onOpenChange(false);
    } catch (err) {
      if (err instanceof TradeValidationError) toast.error(err.message);
      else toast.error("Trade failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 border-ink/15 bg-paper p-0">
        <DialogHeader className="border-b border-ink/10 px-8 py-6">
          <div className="eyebrow mb-2">
            {side === "buy" ? "Execute purchase" : "Execute sale"}
          </div>
          <DialogTitle className="font-display text-4xl font-semibold leading-none tracking-tight">
            {symbol}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-ink-soft">
            Virtual execution against the current quote. Ledger and book
            update on confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 py-6">
          <div className="mb-5 inline-flex border-hairline border-ink/25">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                onMouseEnter={() => side !== s && play("tick")}
                className={cn(
                  "px-4 py-2 text-xs uppercase tracking-[0.22em] transition-colors",
                  side === s
                    ? s === "buy"
                      ? "bg-rose text-paper"
                      : "bg-plum text-paper"
                    : "text-ink-mute hover:text-ink"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-px bg-ink/10">
            <Info
              label="Current quote"
              value={
                quote
                  ? quote.assetClass === "fx"
                    ? formatNumber(quote.price, 4)
                    : formatCurrency(quote.price, quote.currency)
                  : "—"
              }
            />
            <Info
              label="Cash on hand"
              value={formatCurrency(portfolio.cash)}
            />
          </div>

          {position && (
            <div className="mt-5 flex items-center justify-between border-t border-ink/10 pt-3 text-xs text-ink-mute">
              <span>
                You hold{" "}
                <span className="num text-ink">
                  {formatNumber(position.qty, 4)}
                </span>{" "}
                @ avg{" "}
                <span className="num text-ink">
                  {formatNumber(position.avgCost, 4)}
                </span>
              </span>
              {quote && (
                <span className="num">
                  Mkt value{" "}
                  {formatCurrency(position.qty * quote.price, quote.currency)}
                </span>
              )}
            </div>
          )}

          <div className="mt-6 flex items-baseline justify-between">
            <label className="eyebrow" htmlFor="qty">
              Quantity
            </label>
            <span className="num text-xs text-ink-mute">
              {canTrade && quote
                ? `≈ ${formatCurrency(notional)}`
                : "enter a valid size"}
            </span>
          </div>
          <Input
            id="qty"
            type="number"
            min={0}
            step="any"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            className="mt-2 h-14 rounded-none border-0 border-b border-ink/30 bg-transparent px-0 text-3xl font-display font-medium shadow-none focus-visible:ring-0 focus-visible:border-salmon"
          />

          {quote?.stale && (
            <div className="mt-4 border-l-2 border-salmon bg-salmon/10 px-3 py-2 text-xs text-ink">
              <span className="font-medium">Stale quote.</span>{" "}
              {quote.note ?? "Execution uses the displayed price."}
            </div>
          )}

          {insufficientCash && (
            <div className="mt-4 text-xs text-signal-down">
              Not enough cash — need{" "}
              <span className="num">
                {formatCurrency(notional - portfolio.cash)}
              </span>{" "}
              more.
            </div>
          )}
          {insufficientShares && (
            <div className="mt-4 text-xs text-signal-down">
              You only hold{" "}
              <span className="num">{formatNumber(position?.qty ?? 0, 4)}</span>{" "}
              of {symbol}.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink/10 bg-paper-sub px-8 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-xs uppercase tracking-[0.22em] text-ink-mute transition-colors hover:text-ink disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              !canTrade ||
              submitting ||
              insufficientCash ||
              insufficientShares
            }
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
              side === "buy"
                ? "bg-rose text-paper hover:-translate-y-px hover:shadow-[0_12px_28px_-12px_hsl(var(--rose))]"
                : "bg-plum text-paper hover:-translate-y-px hover:shadow-[0_12px_28px_-12px_hsl(var(--plum))]"
            )}
          >
            {submitting
              ? "Committing…"
              : side === "buy"
                ? `Commit buy · ${formatCurrency(notional)}`
                : `Commit sell · ${formatCurrency(notional)}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-4">
      <div className="eyebrow">{label}</div>
      <div className="num mt-2 text-lg font-medium">{value}</div>
    </div>
  );
}
