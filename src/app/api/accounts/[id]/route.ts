import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // 1. Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 2. Delete the record from social_accounts

    const { error: dbError } = await supabase
      .from("social_accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account delete error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}
