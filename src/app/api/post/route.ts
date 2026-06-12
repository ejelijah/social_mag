import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase-auth";
import { postToPlatform, type Platform } from "@/services/social";
import type { SocialAccount } from "@/types/social";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if ("response" in auth) return auth.response;

    const { user, supabase } = auth;

    const { platforms, content } = await req.json();
    if (!platforms?.length || !content?.text) {
      return NextResponse.json(
        { error: "Platforms and content.text are required" },
        { status: 400 }
      );
    }

    const { data: rows, error } = await supabase
      .from("social_accounts")
      .select(
        "id, provider_name, access_token, provider, metadata"
      )
      .eq("user_id", user.id)
      .in("provider_name", platforms as string[]);

    if (error) {
      console.error("social_accounts for post:", error);
      return NextResponse.json(
        { error: "Failed to load connected accounts" },
        { status: 500 }
      );
    }

    const mapRow = (row: Record<string, unknown>): SocialAccount => ({
      accessToken: row.access_token as string,
      providerId: (row.provider_id as string | null) ?? null,
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : null,
    });

    const accounts = rows ?? [];
    const results: Record<string, { id?: string; error?: string }> = {};

    for (const platform of platforms as Platform[]) {
      const row = accounts.find((a) => a.provider_name === platform);
      if (!row) {
        results[platform] = { error: "Account not connected" };
        continue;
      }

      try {
        const { id } = await postToPlatform(
          mapRow(row as Record<string, unknown>),
          platform,
          content
        );
        results[platform] = { id };
      } catch (err) {
        results[platform] = {
          error: err instanceof Error ? err.message : "Post failed",
        };
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Post failed" },
      { status: 500 }
    );
  }
}
