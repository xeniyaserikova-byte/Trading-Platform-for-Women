import { NextResponse } from "next/server";
import { z } from "zod";
import { searchSymbols, MarketDataError } from "@/lib/market-data/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().min(1).max(50),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ q: searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing q parameter" },
      { status: 400 }
    );
  }

  try {
    const results = await searchSymbols(parsed.data.q);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof MarketDataError) {
      const status = err.code === "rate_limited" ? 429 : 502;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status }
      );
    }
    return NextResponse.json(
      { error: "Internal error", code: "unknown" },
      { status: 500 }
    );
  }
}
