"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { WavickChat } from "@/components/wavick-chat";

export default function WavickPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Wavick — Your resident trader"
        title={
          <>
            Tell me how you
            <br />
            want to <span className="italic text-rose">invest.</span>
          </>
        }
        lede={
          <>
            Wavick is an AI trading companion. It will ask a few questions about
            your strategy, then propose a concrete plan and — with your approval —
            execute real trades against live quotes in your paper account.
          </>
        }
      />

      {/* useSearchParams() forces a CSR bail-out for this subtree — wrap in
          Suspense so the rest of the page can still be pre-rendered at build
          time. Netlify / Vercel / any other target requires this for Next 14+. */}
      <React.Suspense fallback={<WavickLoading />}>
        <WavickWithHint />
      </React.Suspense>
    </div>
  );
}

function WavickWithHint() {
  const params = useSearchParams();
  const hintedSymbol = params?.get("about") ?? undefined;
  return <WavickChat hintedSymbol={hintedSymbol} />;
}

function WavickLoading() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <div className="eyebrow">Summoning Wavick…</div>
      <p className="mt-2 text-sm text-ink-mute">One moment.</p>
    </div>
  );
}
