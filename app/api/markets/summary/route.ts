import { NextResponse } from "next/server";
import { buildMarketSummary } from "@/lib/market-data/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await buildMarketSummary();
    return NextResponse.json(summary, {
      headers: {
        // Allow Next.js dev server to cache on the client briefly; the
        // provider's internal caches handle the heavy lifting.
        "Cache-Control":
          "public, max-age=15, s-maxage=15, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to build market summary: ${message}` },
      { status: 502 }
    );
  }
}
