"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { WavickChat } from "@/components/wavick-chat";

export default function WavickPage() {
  const params = useSearchParams();
  const hintedSymbol = params?.get("about") ?? undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Wavick — Your resident trader"
        title={
          <>
            Tell me how you
            <br />
            want to <span className="italic text-salmon">invest.</span>
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

      <WavickChat hintedSymbol={hintedSymbol} />
    </div>
  );
}
