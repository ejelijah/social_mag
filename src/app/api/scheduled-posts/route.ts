import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase-auth";

export async function GET() {
  try {
    const auth = await requireAuthUser();
    if ("response" in auth) return auth.response;

    const { user, supabase } = auth;

    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("id, platforms, content, scheduledAt, status, createdAt")
      .eq("userId", user.id)
      .order("scheduledAt", { ascending: true });

    if (error) {
      console.error("scheduled_posts list:", error);
      return NextResponse.json(
        { error: "Failed to load scheduled posts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ scheduled_posts: data ?? [] });
  } catch (e) {
    console.error("scheduled-posts GET:", e);
    return NextResponse.json(
      { error: "Failed to load scheduled posts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if ("response" in auth) return auth.response;

    const { user, supabase } = auth;
    const body = await req.json();
    const { platforms, content, scheduledAt } = body;

    if (
      !Array.isArray(platforms) ||
      !platforms.length ||
      typeof content?.text !== "string" ||
      typeof scheduledAt !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "platforms (non-empty array), content.text, and scheduledAt (ISO) are required",
        },
        { status: 400 }
      );
    }

    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json(
        { error: "scheduledAt must be a valid date" },
        { status: 400 }
      );
    }

    if (when.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "scheduledAt must be in the future" },
        { status: 400 }
      );
    }

    const row = {
      userId: user.id,
      platforms: platforms.map(String),
      content: {
        text: content.text,
        ...(typeof content.imageUrl === "string"
          ? { imageUrl: content.imageUrl }
          : {}),
      },
      scheduledAt: when.toISOString(),
      status: "pending",
    };

    const { data, error } = await supabase
      .from("scheduled_posts")
      .insert(row)
      .select("id, platforms, content, scheduledAt, status, createdAt")
      .single();

    if (error) {
      console.error("scheduled_posts insert:", error);
      return NextResponse.json(
        { error: "Failed to schedule post" },
        { status: 500 }
      );
    }

    return NextResponse.json({ scheduled_post: data });
  } catch (e) {
    console.error("scheduled-posts POST:", e);
    return NextResponse.json(
      { error: "Failed to schedule post" },
      { status: 500 }
    );
  }
}
