import { NextResponse } from "next/server";
import {
  generateWavickReply,
  WavickInputSchema,
} from "@/lib/ai/wavick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 501 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = WavickInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      },
      { status: 400 }
    );
  }

  try {
    const reply = await generateWavickReply(parsed.data);
    return NextResponse.json(reply);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Wavick failed to respond: ${message}` },
      { status: 502 }
    );
  }
}
