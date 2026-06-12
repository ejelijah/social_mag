import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if ("response" in auth) return auth.response;

    const { prompt, model = "flux" } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Correct Pollinations image generation URL format
    const result = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${model}`;

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
