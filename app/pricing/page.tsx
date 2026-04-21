"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Minus,
  Sparkles,
  Heart,
  Crown,
  Gem,
  ArrowRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { useSound } from "@/components/providers/sound-provider";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Plans                                                                      */
/* -------------------------------------------------------------------------- */

type TierId = "blush" | "rose" | "ruby";

interface Tier {
  id: TierId;
  name: string;
  tagline: string;
  blurb: string;
  monthly: number;
  yearly: number;
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: {
    ring: string;
    chip: string;
    button: string;
    border: string;
    bg: string;
    text: string;
    glow: string;
  };
  highlights: string[];
  badge?: "Most Loved" | "For Beginners" | "Pro";
}

const TIERS: Tier[] = [
  {
    id: "blush",
    name: "Blush",
    tagline: "Dip your toe in",
    blurb:
      "Everything you need to learn the rhythm of the market — no card required.",
    monthly: 0,
    yearly: 0,
    cta: "Start free",
    icon: Heart,
    badge: "For Beginners",
    accent: {
      ring: "ring-blush",
      chip: "bg-blush text-plum",
      button:
        "bg-ink text-paper hover:bg-plum",
      border: "border-blush",
      bg: "bg-paper",
      text: "text-plum",
      glow: "hsl(var(--blush))",
    },
    highlights: [
      "1 chart per tab",
      "3 indicators per chart",
      "10 price alerts",
      "1 watchlist",
      "Web & mobile",
    ],
  },
  {
    id: "rose",
    name: "Rosé",
    tagline: "Most loved, for a reason",
    blurb:
      "The one we recommend — volume profile, bar replay, and room to grow a real strategy.",
    monthly: 19,
    yearly: 15,
    cta: "Go Rosé",
    icon: Sparkles,
    badge: "Most Loved",
    accent: {
      ring: "ring-rose",
      chip: "bg-rose text-paper",
      button:
        "bg-rose text-paper hover:bg-rose-deep shadow-[0_12px_28px_-12px_hsl(var(--rose))]",
      border: "border-rose",
      bg: "bg-paper-sub",
      text: "text-rose-deep",
      glow: "hsl(var(--rose))",
    },
    highlights: [
      "2 charts per tab · 5 indicators",
      "Volume profile",
      "Bar Replay",
      "Chart data export",
      "No ads, ever",
    ],
  },
  {
    id: "ruby",
    name: "Ruby",
    tagline: "Everything, unlocked",
    blurb:
      "For the woman who treats the market like a second language — every tool, every limit lifted.",
    monthly: 39,
    yearly: 31,
    cta: "Become Ruby",
    icon: Crown,
    badge: "Pro",
    accent: {
      ring: "ring-ruby",
      chip: "bg-ruby text-paper",
      button:
        "bg-ruby text-paper hover:bg-plum shadow-[0_14px_34px_-10px_hsl(var(--ruby))]",
      border: "border-ruby",
      bg: "bg-paper",
      text: "text-ruby",
      glow: "hsl(var(--ruby))",
    },
    highlights: [
      "4 charts per tab · 10 indicators",
      "10K historical bars",
      "100 price + 100 technical alerts",
      "Custom Range Bars & timeframes",
      "Indicators on indicators",
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Feature matrix                                                             */
/* -------------------------------------------------------------------------- */

type Cell =
  | { kind: "text"; value: string }
  | { kind: "check" }
  | { kind: "cross" };

interface FeatureRow {
  group: string;
  label: string;
  blush: Cell;
  rose: Cell;
  ruby: Cell;
}

const t = (v: string): Cell => ({ kind: "text", value: v });
const yes: Cell = { kind: "check" };
const no: Cell = { kind: "cross" };

const FEATURES: FeatureRow[] = [
  {
    group: "Charts",
    label: "Charts per tab",
    blush: t("1"),
    rose: t("2"),
    ruby: t("4"),
  },
  {
    group: "Charts",
    label: "Indicators per chart",
    blush: t("3"),
    rose: t("5"),
    ruby: t("10"),
  },
  {
    group: "Charts",
    label: "Historical bars",
    blush: t("2K"),
    rose: t("5K"),
    ruby: t("10K"),
  },
  {
    group: "Charts",
    label: "Parallel chart connections",
    blush: t("5"),
    rose: t("10"),
    ruby: t("20"),
  },
  {
    group: "Alerts",
    label: "Price alerts",
    blush: t("10"),
    rose: t("50"),
    ruby: t("100"),
  },
  {
    group: "Alerts",
    label: "Technical alerts",
    blush: no,
    rose: t("25"),
    ruby: t("100"),
  },
  {
    group: "Alerts",
    label: "Watchlist alerts",
    blush: no,
    rose: no,
    ruby: no,
  },
  {
    group: "Experience",
    label: "Web, desktop & mobile apps",
    blush: t("Web & mobile"),
    rose: yes,
    ruby: yes,
  },
  {
    group: "Experience",
    label: "No ads",
    blush: no,
    rose: yes,
    ruby: yes,
  },
  {
    group: "Experience",
    label: "Multiple watchlists",
    blush: t("1"),
    rose: t("3"),
    ruby: t("Unlimited"),
  },
  {
    group: "Pro tools",
    label: "Volume profile",
    blush: no,
    rose: yes,
    ruby: yes,
  },
  {
    group: "Pro tools",
    label: "Custom timeframes",
    blush: no,
    rose: yes,
    ruby: yes,
  },
  {
    group: "Pro tools",
    label: "Custom Range Bars",
    blush: no,
    rose: no,
    ruby: yes,
  },
  {
    group: "Pro tools",
    label: "Bar Replay",
    blush: no,
    rose: yes,
    ruby: yes,
  },
  {
    group: "Pro tools",
    label: "Indicators on indicators",
    blush: no,
    rose: no,
    ruby: yes,
  },
  {
    group: "Pro tools",
    label: "Chart data export",
    blush: no,
    rose: yes,
    ruby: yes,
  },
];

const GROUPS = Array.from(new Set(FEATURES.map((f) => f.group)));

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function PricingPage() {
  const { play } = useSound();
  const [period, setPeriod] = React.useState<"monthly" | "yearly">("monthly");
  const [selected, setSelected] = React.useState<TierId | null>(null);
  const [confirmation, setConfirmation] = React.useState<TierId | null>(null);

  // Welcome chime, exactly once per page visit.
  React.useEffect(() => {
    const t = window.setTimeout(() => play("chime"), 320);
    return () => window.clearTimeout(t);
  }, [play]);

  const handleSelect = (tier: Tier) => {
    play("select");
    setSelected(tier.id);
  };

  const handleConfirm = (tier: Tier) => {
    play("celebrate");
    setConfirmation(tier.id);
    toast.success(`Welcome to ${tier.name}`, {
      description:
        tier.id === "blush"
          ? "Your free trading lab is ready. Pink carpet rolled out."
          : `Your ${tier.name} plan is active — enjoy the upgrade.`,
      duration: 4200,
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Lipstick & Ledger · Membership"
        title={
          <>
            Pick your{" "}
            <span className="italic text-rose">shade</span>
            <br />
            of market.
          </>
        }
        lede={
          <>
            Three plans, one rose-colored lens on the market. Start free on{" "}
            <span className="font-semibold text-plum">Blush</span>, upgrade to{" "}
            <span className="font-semibold text-rose-deep">Rosé</span> for the
            tools most traders settle on, or go all in on{" "}
            <span className="font-semibold text-ruby">Ruby</span>.
          </>
        }
        right={<BillingToggle value={period} onChange={setPeriod} />}
      />

      {/* Plan cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <PlanCard
            key={tier.id}
            tier={tier}
            period={period}
            selected={selected === tier.id}
            onHover={() => play("sparkle")}
            onSelect={() => handleSelect(tier)}
            onConfirm={() => handleConfirm(tier)}
          />
        ))}
      </div>

      {/* Reassurance row */}
      <div className="mt-10 grid gap-5 rounded-2xl border border-rose/20 bg-paper-sub/70 px-6 py-5 text-sm text-ink-soft sm:grid-cols-3">
        <Reassure
          title="No wardrobe commitment"
          body="Cancel any time. Keep your Blush data forever."
        />
        <Reassure
          title="One card, every device"
          body="Web, desktop, and mobile under a single membership."
        />
        <Reassure
          title="Educational first"
          body="Every trade is virtual — we're here to build skills, not liquidate accounts."
        />
      </div>

      {/* Feature matrix */}
      <section className="mt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Compare · the full kit</div>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">
              Every tool, <span className="italic text-rose">side by side.</span>
            </h2>
          </div>
          <p className="hidden max-w-sm text-sm text-ink-mute md:block">
            Because nobody likes squinting at a footnote before a subscription.
          </p>
        </div>

        <FeatureMatrix onHover={() => play("tick")} onPick={handleSelect} />
      </section>

      {/* Soft FAQ */}
      <section className="mt-20">
        <div className="mb-6">
          <div className="eyebrow">Q &amp; A</div>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
            The quiet questions.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Faq
            q="Is this real money?"
            a="Never. Every trade happens in a paper-money sandbox. Prices are live, losses are not."
          />
          <Faq
            q="Can I switch tiers later?"
            a="Whenever you like. Upgrades apply instantly; downgrades roll in at the next billing cycle."
          />
          <Faq
            q="Why are there no watchlist alerts on any plan?"
            a="We're building them now — they'll ship to Rosé and Ruby first, free of charge, the moment they land."
          />
          <Faq
            q="Is Wavick included?"
            a="Yes, at every tier. Blush members get 20 conversations a month; Rosé and Ruby members get unlimited."
          />
        </div>
      </section>

      {/* Final CTA band */}
      <section className="mt-20 overflow-hidden rounded-3xl border border-rose/40 bg-gradient-to-br from-blush via-paper-sub to-rose/30 px-8 py-12 text-center card-lift">
        <Sparkles className="mx-auto mb-3 h-5 w-5 text-rose-deep" />
        <h3 className="font-display text-3xl font-semibold text-ink md:text-4xl">
          Ready to read the tape{" "}
          <span className="italic text-rose-deep">in your color</span>?
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-sm text-ink-soft">
          Start on Blush for free, no commitments. Promote yourself to Rosé when
          the charts start asking more of you.
        </p>
        <button
          type="button"
          onMouseEnter={() => play("sparkle")}
          onClick={() => handleConfirm(TIERS[0])}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3 text-sm font-semibold text-paper transition-all hover:bg-plum hover:shadow-[0_14px_30px_-12px_hsl(var(--plum))]"
        >
          Start free on Blush
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      <ConfirmationModal
        tier={confirmation ? TIERS.find((t) => t.id === confirmation) ?? null : null}
        period={period}
        onClose={() => {
          setConfirmation(null);
          play("pop");
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Billing toggle                                                             */
/* -------------------------------------------------------------------------- */

function BillingToggle({
  value,
  onChange,
}: {
  value: "monthly" | "yearly";
  onChange: (v: "monthly" | "yearly") => void;
}) {
  const { play } = useSound();
  return (
    <div
      role="radiogroup"
      className="relative flex items-center gap-0 rounded-full border border-rose/40 bg-paper p-1 text-xs font-semibold uppercase tracking-[0.18em]"
    >
      {(["monthly", "yearly"] as const).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              onChange(opt);
              play("whoosh");
            }}
            onMouseEnter={() => !active && play("tick")}
            className={cn(
              "relative rounded-full px-4 py-2 transition-colors",
              active ? "text-paper" : "text-ink-mute hover:text-plum"
            )}
          >
            {active && (
              <span className="absolute inset-0 -z-10 rounded-full bg-rose shadow-[0_6px_18px_-8px_hsl(var(--rose))]" />
            )}
            {opt}
            {opt === "yearly" && (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[9px] tracking-wider",
                  active ? "bg-paper/25 text-paper" : "bg-rose/20 text-rose-deep"
                )}
              >
                −20%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Plan card                                                                  */
/* -------------------------------------------------------------------------- */

function PlanCard({
  tier,
  period,
  selected,
  onHover,
  onSelect,
  onConfirm,
}: {
  tier: Tier;
  period: "monthly" | "yearly";
  selected: boolean;
  onHover: () => void;
  onSelect: () => void;
  onConfirm: () => void;
}) {
  const Icon = tier.icon;
  const price = period === "monthly" ? tier.monthly : tier.yearly;
  const featured = tier.id === "rose";

  return (
    <article
      onMouseEnter={onHover}
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-paper px-7 pb-7 pt-9 transition-all duration-300",
        tier.accent.border,
        "border-opacity-40 hover:border-opacity-100",
        featured
          ? "scale-[1.015] border-2 shadow-[0_24px_60px_-20px_hsl(var(--rose))]"
          : "hover:-translate-y-1 hover:shadow-[0_22px_50px_-24px_hsl(var(--plum))]",
        selected && "scale-[1.01] halo-pulse"
      )}
    >
      {tier.badge && (
        <div
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
            tier.accent.chip
          )}
        >
          {tier.badge === "Most Loved" && (
            <Heart className="mr-1 inline h-3 w-3 fill-current" />
          )}
          {tier.badge}
        </div>
      )}

      <header className="mb-5">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full",
              tier.accent.chip
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-2xl font-semibold leading-none text-ink">
              {tier.name}
            </h3>
            <p className={cn("mt-1 text-xs italic", tier.accent.text)}>
              {tier.tagline}
            </p>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
          {tier.blurb}
        </p>
      </header>

      <div className="mb-6 flex items-baseline gap-2">
        <span className="num font-display text-5xl font-semibold tracking-tight text-ink">
          {price === 0 ? "Free" : `$${price}`}
        </span>
        {price > 0 && (
          <span className="eyebrow text-ink-mute">
            / {period === "yearly" ? "mo · billed yearly" : "mo"}
          </span>
        )}
      </div>

      <ul className="mb-7 flex-1 space-y-3 border-t border-ink/10 pt-5 text-sm text-ink">
        {tier.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                tier.accent.chip
              )}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <span>{h}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => {
          onSelect();
          onConfirm();
        }}
        className={cn(
          "mt-auto inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold tracking-wide transition-all",
          tier.accent.button
        )}
      >
        <Gem className="h-4 w-4" />
        {tier.cta}
      </button>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Feature matrix                                                             */
/* -------------------------------------------------------------------------- */

function FeatureMatrix({
  onHover,
  onPick,
}: {
  onHover: () => void;
  onPick: (t: Tier) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-paper">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-paper-sub">
            <th className="w-[42%] px-6 py-4 eyebrow">Feature</th>
            {TIERS.map((t) => (
              <th key={t.id} className="px-6 py-4">
                <button
                  type="button"
                  onClick={() => onPick(t)}
                  className="group inline-flex items-center gap-2"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      t.id === "blush" && "bg-blush",
                      t.id === "rose" && "bg-rose",
                      t.id === "ruby" && "bg-ruby"
                    )}
                  />
                  <span className="font-display text-base font-semibold text-ink group-hover:text-rose-deep">
                    {t.name}
                  </span>
                  <span className="num text-[11px] text-ink-mute">
                    ${t.monthly}/mo
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group, gi) => (
            <React.Fragment key={group}>
              <tr>
                <td
                  colSpan={4}
                  className={cn(
                    "px-6 py-3 eyebrow text-plum",
                    gi === 0 ? "border-t-0" : "border-t border-ink/10"
                  )}
                >
                  {group}
                </td>
              </tr>
              {FEATURES.filter((f) => f.group === group).map((row, i) => (
                <tr
                  key={row.label}
                  onMouseEnter={onHover}
                  className={cn(
                    "border-t border-ink/5 transition-colors hover:bg-blush/40",
                    i % 2 ? "bg-paper" : "bg-paper/60"
                  )}
                >
                  <td className="px-6 py-3 text-ink-soft">{row.label}</td>
                  <MatrixCell cell={row.blush} tier="blush" />
                  <MatrixCell cell={row.rose} tier="rose" />
                  <MatrixCell cell={row.ruby} tier="ruby" />
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixCell({ cell, tier }: { cell: Cell; tier: TierId }) {
  const color =
    tier === "blush"
      ? "text-plum"
      : tier === "rose"
        ? "text-rose-deep"
        : "text-ruby";
  return (
    <td className="px-6 py-3">
      {cell.kind === "check" && (
        <span className={cn("inline-flex items-center gap-1.5 text-sm", color)}>
          <Check className="h-4 w-4" strokeWidth={2.5} />
          Included
        </span>
      )}
      {cell.kind === "cross" && (
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-mute/70">
          <Minus className="h-4 w-4" />
          —
        </span>
      )}
      {cell.kind === "text" && (
        <span className={cn("num text-sm font-medium", color)}>
          {cell.value}
        </span>
      )}
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/* Small bits                                                                 */
/* -------------------------------------------------------------------------- */

function Reassure({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="eyebrow text-rose-deep">{title}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const { play } = useSound();
  return (
    <div
      onMouseEnter={() => play("tick")}
      className="rounded-xl border border-ink/10 bg-paper p-5 transition-colors hover:border-rose/60"
    >
      <div className="font-display text-lg font-semibold text-ink">{q}</div>
      <p className="mt-1.5 text-sm text-ink-soft">{a}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirmation modal                                                         */
/* -------------------------------------------------------------------------- */

function ConfirmationModal({
  tier,
  period,
  onClose,
}: {
  tier: Tier | null;
  period: "monthly" | "yearly";
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!tier) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tier, onClose]);

  if (!tier) return null;

  const Icon = tier.icon;
  const price = period === "monthly" ? tier.monthly : tier.yearly;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-plum/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        className="sparkle-pop relative w-full max-w-md rounded-3xl border border-rose/40 bg-paper p-8 text-center shadow-[0_40px_120px_-30px_hsl(var(--plum))]"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-ink-mute hover:bg-blush/40 hover:text-plum"
        >
          <X className="h-4 w-4" />
        </button>

        <ConfettiRing />

        <div
          className={cn(
            "mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full",
            tier.accent.chip
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="eyebrow text-rose-deep">Welcome to</div>
        <h3 className="mt-2 font-display text-4xl font-semibold text-ink">
          {tier.name}
        </h3>
        <p className="mx-auto mt-3 max-w-xs text-sm text-ink-soft">
          {price === 0
            ? "Your free trading lab is live. No card, no timer — take your time."
            : `You're on ${tier.name} at $${price}/mo${
                period === "yearly" ? ", billed yearly" : ""
              }. Every tool just unlocked.`}
        </p>

        <div className="mt-6 flex flex-col items-stretch gap-2">
          <Link
            href="/"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-plum"
          >
            Open the markets
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/wavick"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-rose/50 bg-rose/10 px-5 py-2.5 text-sm font-semibold text-rose-deep transition-colors hover:bg-rose/20"
          >
            <Sparkles className="h-4 w-4" />
            Say hi to Wavick
          </Link>
        </div>
      </div>
    </div>
  );
}

function ConfettiRing() {
  // CSS-only confetti — 14 little dots radiating out, looks like a sparkle crown.
  const dots = Array.from({ length: 14 });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2"
    >
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        const r = 52;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const hue = i % 3 === 0 ? "bg-ruby" : i % 3 === 1 ? "bg-rose" : "bg-blush";
        return (
          <span
            key={i}
            className={cn("absolute h-1.5 w-1.5 rounded-full opacity-90", hue)}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              animation: `sparkle-pop 0.9s ${i * 0.03}s both`,
            }}
          />
        );
      })}
    </div>
  );
}
