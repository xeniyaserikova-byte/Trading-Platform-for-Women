"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  right,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-8", className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-2xl">
          <div className="eyebrow mb-3">{eyebrow}</div>
          <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-tight text-ink md:text-7xl">
            {title}
          </h1>
          {lede && (
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft md:text-lg">
              {lede}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="mt-8 h-[2px] w-full bg-ink/10">
        <div className="h-full w-24 bg-salmon" />
      </div>
    </header>
  );
}
