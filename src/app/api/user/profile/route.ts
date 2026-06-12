import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase-auth";
import { ensureUserRow } from "@/lib/users";
import { isGoogleAuthUser } from "@/lib/auth-identities";

export async function GET() {
  try {
    const auth = await requireAuthUser();
    if ("response" in auth) return auth.response;

    const { user, supabase } = auth;
    await ensureUserRow(supabase, user);

    const { data, error } = await supabase
      .from("users")
      .select("name, needs_name_setup")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("users fetch:", error);
      return NextResponse.json(
        { error: "Failed to load profile" },
        { status: 500 }
      );
    }

    const google = isGoogleAuthUser(user);

    return NextResponse.json({
      profile: {
        name: data.name,
        needs_name_setup: Boolean(data.needs_name_setup),
        can_edit_name: !google,
      },
    });
  } catch (e) {
    console.error("profile GET:", e);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if ("response" in auth) return auth.response;

    const { user, supabase } = auth;

    if (isGoogleAuthUser(user)) {
      return NextResponse.json(
        { error: "Google sign-in accounts use the name from your Google profile." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const raw = typeof body.name === "string" ? body.name.trim() : "";
    if (!raw) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    await ensureUserRow(supabase, user);

    const patch = {
      name: raw,
      needs_name_setup: false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("users")
      .update(patch)
      .eq("id", user.id)
      .select("name, needs_name_setup")
      .single();

    if (error) {
      console.error("users update:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    const { error: metaErr } = await supabase.auth.updateUser({
      data: { full_name: raw, name: raw },
    });
    if (metaErr) {
      console.warn("auth.updateUser metadata:", metaErr.message);
    }

    return NextResponse.json({
      profile: {
        name: data.name,
        needs_name_setup: Boolean(data.needs_name_setup),
        can_edit_name: true,
      },
    });
  } catch (e) {
    console.error("profile PATCH:", e);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
