

import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase-auth";
import { searchPexelsVideos } from "@/services/ai/pexels";
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") ?? "business";
    const perPage = Math.min(parseInt(searchParams.get("per_page") ?? "5", 10), 15);

    const videos = await searchPexelsVideos(query, perPage);
    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Pexels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
