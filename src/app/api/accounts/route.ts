
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from("social_accounts")
      .select(
        "id, provider_name, display_name, username"
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("social_accounts fetch:", error);
      return NextResponse.json(
        { error: "Failed to load accounts" },
        { status: 500 }
      );
    }

    const accounts = (rows ?? []).map((row) => ({
      id: row.id as string,
      providerName: row.provider_name as string,
      displayName: (row.display_name as string | null) ?? null,
      username: (row.username as string | null) ?? null,
    }));

    return NextResponse.json({ accounts });
  } catch (e) {
    console.error("accounts GET:", e);
    return NextResponse.json(
      { error: "Failed to load accounts" },
      { status: 500 }
    );
  }
}
