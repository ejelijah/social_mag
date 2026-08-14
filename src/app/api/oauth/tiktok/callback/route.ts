import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.redirect(`${origin}/dashboard/accounts?error=no_code`);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User session not found.");

    // Fetch Elijah ej's name from the users table
    const { data: profile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const displayUserName = profile?.name || "Elijah ej";

    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!.trim(),
        client_secret: process.env.TIKTOK_CLIENT_SECRET!.trim(),
        code: code,
        grant_type: "authorization_code",
        redirect_uri: "https://omnipost.one/api/oauth/tiktok/callback",
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokens.error_description || "TikTok exchange failed");

    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: user.id,
        platform: "tiktok",
        provider: "tiktok",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        is_connected: true,
        username: displayUserName, // Updated to use name from DB
        metadata: JSON.stringify(tokens),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (tokens.expires_in || 86400) * 1000).toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) throw new Error(`Database Error: ${upsertError.message}`);

    return NextResponse.redirect(`${origin}/dir/create`);
  } catch (error: any) {
    return NextResponse.redirect(`${origin}/dashboard/accounts?error=${encodeURIComponent(error.message)}`);
  }
}
