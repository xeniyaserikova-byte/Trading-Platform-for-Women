import * as React from "react";
import { cn } from "@/lib/utils";

interface SparklinePoint {
  date?: string;
  close: number;
}

interface SparklineProps {
  points: SparklinePoint[] | number[];
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
  showArea?: boolean;
  /**
   * Color scheme:
   *  - "auto"    → up=green / down=red
   *  - "pink"    → always in the brand rose/plum family (up=rose, down=plum)
   *  - "rose"    → a flat brand rose regardless of direction
   *  - "neutral" → ink
   *  - "up"/"down" → force the positive/negative tone explicitly
   */
  tone?: "auto" | "pink" | "rose" | "neutral" | "up" | "down";
  showAxis?: boolean;
  ariaLabel?: string;
}

/**
 * Zero-dependency SVG sparkline — line + soft area gradient. Renders robustly
 * even when history fetch fails: a single point becomes an empty baseline.
 */
export function Sparkline({
  points: input,
  width = 320,
  height = 64,
  className,
  strokeWidth = 1.5,
  showArea = true,
  tone = "auto",
  showAxis = false,
  ariaLabel,
}: SparklineProps) {
  const points = normalize(input);

  if (points.length < 2) {
    return (
      <div
        className={cn("flex items-center text-[10px] text-ink-mute", className)}
        style={{ width, height }}
        aria-label={ariaLabel ?? "no data"}
      >
        <span className="eyebrow">no history</span>
      </div>
    );
  }

  const first = points[0].close;
  const last = points[points.length - 1].close;
  const isUp = last >= first;
  type Resolved = "up" | "down" | "neutral" | "rose" | "plum";
  const resolvedTone: Resolved =
    tone === "auto"
      ? isUp
        ? "up"
        : "down"
      : tone === "pink"
        ? isUp
          ? "rose"
          : "plum"
        : tone === "rose"
          ? "rose"
          : tone;

  const min = Math.min(...points.map((p) => p.close));
  const max = Math.max(...points.map((p) => p.close));
  const span = max - min || 1;

  const pad = showAxis ? 28 : 2;
  const bottomPad = showAxis ? 20 : 2;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad - bottomPad);

  const x = (i: number) =>
    pad + (i / (points.length - 1)) * innerW;
  const y = (v: number) =>
    pad + innerH - ((v - min) / span) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${y(p.close).toFixed(2)}`)
    .join(" ");
  const areaPath =
    linePath +
    ` L${x(points.length - 1).toFixed(2)} ${(pad + innerH).toFixed(2)}` +
    ` L${x(0).toFixed(2)} ${(pad + innerH).toFixed(2)} Z`;

  const gradientId = React.useId();
  // Rose (up), plum (down) keeps the chart in brand. Up is still vivid so
  // positives read instantly; down uses a deeper plum so "loss" doesn't feel
  // alarming the way red does.
  const stroke =
    resolvedTone === "up"
      ? "hsl(var(--rose-deep, 344 78% 54%))"
      : resolvedTone === "down"
        ? "hsl(var(--plum, 338 55% 32%))"
        : resolvedTone === "rose"
          ? "hsl(var(--rose, 344 92% 72%))"
          : resolvedTone === "plum"
            ? "hsl(var(--plum, 338 55% 32%))"
            : "currentColor";
  const areaTop =
    resolvedTone === "up" || resolvedTone === "rose"
      ? "hsl(var(--rose-glow, 344 100% 82%))"
      : stroke;

  // Derive tick labels for the x-axis (first / quarter / mid / three-quarter / last)
  const axisTicks = showAxis
    ? [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const idx = Math.min(
          points.length - 1,
          Math.max(0, Math.round(t * (points.length - 1)))
        );
        return { idx, label: formatTickLabel(points[idx]) };
      })
    : [];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={ariaLabel ?? "price sparkline"}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={areaTop} stopOpacity={0.55} />
          <stop offset="60%" stopColor={stroke} stopOpacity={0.18} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      {showArea && (
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showAxis && (
        <>
          {/* Subtle baseline */}
          <line
            x1={pad}
            x2={width - pad}
            y1={pad + innerH + 0.5}
            y2={pad + innerH + 0.5}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth={1}
          />
          {axisTicks.map((t, i) => (
            <text
              key={i}
              x={x(t.idx)}
              y={height - 4}
              textAnchor={
                i === 0 ? "start" : i === axisTicks.length - 1 ? "end" : "middle"
              }
              className="fill-current text-[10px] text-ink-mute"
              style={{ fontFamily: "var(--font-mono, monospace)" }}
            >
              {t.label}
            </text>
          ))}
        </>
      )}
    </svg>
  );
}

function normalize(input: SparklinePoint[] | number[]): SparklinePoint[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  if (typeof input[0] === "number") {
    return (input as number[]).map((close) => ({ close }));
  }
  return input as SparklinePoint[];
}

function formatTickLabel(p: SparklinePoint): string {
  if (!p.date) return "";
  // Input format: YYYY-MM-DD. Render as HH:00 for intraday, or MMM DD for
  // anything daily. Since we're only using daily, stick to "MMM DD".
  const d = new Date(p.date);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${d.getDate()}`;
}
