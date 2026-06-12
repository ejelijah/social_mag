import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase-auth";
import { generateText, type TextModel } from "@/services/ai/text";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if ("response" in auth) return auth.response;

    // Changed default model from "gemini" to "grok"
    const { prompt, model = "grok" } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const result = await generateText(prompt, model as TextModel);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Text generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
