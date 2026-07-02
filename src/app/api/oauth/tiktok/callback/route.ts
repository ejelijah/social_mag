import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { upsertUserFromAuth } from "@/lib/users";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard/accounts?error=no_code`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=unauthorized`);
  }

  try {
    // Exchange code for Access Token
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/auth/tiktok/callback`,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || "Failed to exchange TikTok code");
    }

    // Save TikTok tokens to social_accounts table
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: user.id,
        platform: "tiktok",
        provider: "tiktok",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        is_connected: true,
        updated_at: new Date().toISOString(),
        // TikTok tokens usually expire in 24 hours (86400 seconds)
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        username: "TikTok User", // You can fetch profile info with another API call if needed
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) throw upsertError;

    return NextResponse.redirect(`${origin}/dashboard/accounts?success=tiktok_connected`);
  } catch (error: any) {
    console.error("TikTok Auth Error:", error.message);
    return NextResponse.redirect(`${origin}/dashboard/accounts?error=tiktok_sync_failed`);
  }
}