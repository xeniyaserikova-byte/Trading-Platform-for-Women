import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuotes, MarketDataError } from "@/lib/market-data/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  symbols: z
    .string()
    .min(1, "symbols is required")
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().min(1)).min(1).max(25)),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    symbols: searchParams.get("symbols") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  try {
    const quotes = await getQuotes(parsed.data.symbols);
    return NextResponse.json({ quotes });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
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
