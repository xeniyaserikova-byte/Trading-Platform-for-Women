"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Volume2, VolumeX, Sparkles } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio } from "@/components/providers/portfolio-provider";
import { useSound } from "@/components/providers/sound-provider";
import { useQuotes } from "@/hooks/use-quotes";
import { portfolioSnapshot } from "@/lib/trading/execute";

const LINKS = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Book" },
  { href: "/history", label: "Ledger" },
  { href: "/wavick", label: "Wavick", accent: true },
];

export function TopNav() {
  const pathname = usePathname();
  const { portfolio, hydrated } = usePortfolio();
  const { muted, toggleMuted, play } = useSound();
  const symbols = portfolio.positions.map((p) => p.symbol);
  const { quotes } = useQuotes(symbols, 60_000);
  const snap = portfolioSnapshot(portfolio, quotes);
  const pnlUp = snap.unrealizedPnL >= 0;

  return (
    <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="container flex h-14 items-center justify-between gap-6 border-b border-ink/10">
        <Link
          href="/"
          className="brand-word flex items-baseline gap-2"
          onMouseEnter={() => play("sparkle")}
        >
          <span className="text-xl font-semibold leading-none tracking-tight">
            Lipstick
          </span>
          <span className="text-xl italic leading-none text-rose">&amp;</span>
          <span className="text-xl font-semibold leading-none tracking-tight">
            Ledger
          </span>
          <span className="eyebrow ml-2 hidden sm:inline">
            Markets, in your color
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onMouseEnter={() => play("tick")}
                onClick={() => play("select")}
                className={cn(
                  "relative px-3 py-1.5 text-sm transition-colors",
                  active ? "text-ink" : "text-ink-mute hover:text-ink",
                  link.accent &&
                    !active &&
                    "font-display italic text-rose hover:text-rose-deep"
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[1px] h-[2px] bg-rose" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-5 text-sm">
          {hydrated ? (
            <>
              <Stat label="Cash" value={formatCurrency(snap.cash)} />
              <span className="hidden h-8 w-px bg-ink/10 sm:inline-block" />
              <Stat
                label="Equity"
                value={formatCurrency(snap.totalEquity)}
                emphasized
              />
              {portfolio.positions.length > 0 && (
                <Stat
                  label="Unrealized"
                  value={`${pnlUp ? "+" : ""}${formatCurrency(snap.unrealizedPnL)}`}
                  tone={pnlUp ? "up" : "down"}
                />
              )}
            </>
          ) : (
            <span className="eyebrow">loading…</span>
          )}

          <Link
            href="/pricing"
            onMouseEnter={() => play("sparkle")}
            onClick={() => play("whoosh")}
            className={cn(
              "relative hidden items-center gap-1.5 rounded-full border border-rose/50 bg-rose/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-plum transition-all hover:border-rose hover:bg-rose/30 hover:shadow-[0_8px_22px_-12px_hsl(var(--rose))] sm:inline-flex",
              pathname?.startsWith("/pricing") &&
                "border-ruby bg-ruby/15 text-ruby halo-pulse"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-rose-deep" />
            Upgrade
          </Link>

          <button
            type="button"
            onClick={toggleMuted}
            aria-label={muted ? "Turn sound on" : "Turn sound off"}
            title={muted ? "Sound is off" : "Sound is on"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink/10 text-ink-mute transition-colors hover:border-rose hover:text-rose-deep"
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  emphasized,
  tone,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  tone?: "up" | "down";
}) {
  return (
    <div className="text-right leading-tight">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          "num",
          emphasized ? "text-[15px] font-medium text-ink" : "text-ink-soft",
          tone === "up" && "text-signal-up",
          tone === "down" && "text-signal-down"
        )}
      >
        {value}
      </div>
    </div>
  );
}
