import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const nextPath = "/dir/create";

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?error=no_code_received`);
  }

  try {
    const supabase = await createClient();
    
    // 1. Check for User Session
    // If this fails, it's why you were sent back to the login page.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("User session not found. Please log in again.");
    }

    // 2. Exchange Code for Short-Lived Access Token
    const shortLivedParams = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: "https://omnipost.one/api/oauth/instagram/callback", 
      code: code,
    });

    const shortLivedRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: shortLivedParams,
    });

    const shortLivedData = await shortLivedRes.json();
    if (!shortLivedRes.ok) {
      throw new Error(`Instagram Exchange Failed: ${shortLivedData.error_message || "Invalid Secret or Code"}`);
    }

    const shortLivedToken = shortLivedData.access_token;

    // 3. Exchange for Long-Lived Token (60 Days)
    // This is vital so the user doesn't have to reconnect every hour.
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`
    );

    const longLivedData = await longLivedRes.json();
    if (!longLivedRes.ok) throw new Error("Failed to upgrade to long-lived token.");

    const longLivedToken = longLivedData.access_token;

    // 4. Save to social_accounts
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        platform: "instagram",
        provider: "instagram",
        access_token: longLivedToken,
        is_connected: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) throw new Error(`Database Error: ${upsertError.message}`);

    // 5. Final Redirect to the Create Page
    return NextResponse.redirect(`${origin}${nextPath}`);

  } catch (err: any) {
    console.error("INSTAGRAM_CALLBACK_ERROR:", err.message);
    const errorMessage = encodeURIComponent(err.message);
    return NextResponse.redirect(`${origin}/dashboard?error=${errorMessage}`);
  }
}