import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard/accounts?error=${encodeURIComponent("No authorization code provided by TikTok")}`);
  }

  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("User session not found. Please log in again.")}`);
    }

    // Exchange code for Access Token
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!.trim(),
        client_secret: process.env.TIKTOK_CLIENT_SECRET!.trim(),
        code: code,
        grant_type: "authorization_code",
        redirect_uri: `https://omnipost.one/api/oauth/tiktok/callback`,
      }),
    });

    const tokens = await tokenResponse.json();
    console.log("TikTok API Response:", tokens);
    if (!tokenResponse.ok) {
      // Extract specific TikTok error message if available
      const errorMessage = tokens.error_description || tokens.message || "Failed to exchange TikTok code";
      throw new Error(errorMessage);
    }
    if (!tokens.access_token) {
      throw new Error("TikTok returned a success response but no access_token was found. Response: " + JSON.stringify(tokens));
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
        expires_at: new Date(Date.now() + (tokens.expires_in || 86400) * 1000).toISOString(),
        username: tokens.open_id || null, // TikTok's unique user identifier
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) {
        throw new Error(`Database Error: ${upsertError.message}`);
    }

    return NextResponse.redirect(`${origin}/dir/create`);
  } catch (error: any) {
    console.error("TikTok Auth Error:", error.message);
    // Redirect back to the dashboard with the specific error message in the URL
    return NextResponse.redirect(`${origin}/dashboard/accounts?error=${encodeURIComponent(error.message)}`);
  }
}