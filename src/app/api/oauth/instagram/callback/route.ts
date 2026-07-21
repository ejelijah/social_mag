import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = "/dir/accounts";

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?error=no_code_received`);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User session not found");

    // 1. Exchange Code for Short-Lived Token
    // Note: Instagram uses a specific endpoint for the initial exchange
    const shortLivedParams = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri:"https://omnipost.one/api/oauth/instagram/callback", // Must MATCH Meta Console exactly
      code: code,
    });

    const shortLivedRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: shortLivedParams,
    });

    const shortLivedData = await shortLivedRes.json();
    if (shortLivedData.error) {
      throw new Error(`Meta Short-Lived Error: ${shortLivedData.error_message || shortLivedData.error.message}`);
    }

    const shortLivedToken = shortLivedData.access_token;
    const instagramUserId = shortLivedData.user_id;

    // 2. Exchange for Long-Lived Token (60 Days)
    // This uses the Graph API endpoint
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&access_token=${shortLivedToken}`
    );

    const longLivedData = await longLivedRes.json();
    if (longLivedData.error) throw new Error(`Long-Lived Exchange Failed: ${longLivedData.error.message}`);

    const longLivedToken = longLivedData.access_token;

    // 3. Save to social_accounts
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: user.id,
        platform: "instagram",
        provider: "instagram",
        access_token: longLivedToken,
        username: instagramUserId, // Or fetch the actual username via Graph API
        is_connected: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) throw new Error(`Database Save Failed: ${upsertError.message}`);

    return NextResponse.redirect(`${origin}${nextPath}`);

  } catch (err: any) {
    console.error("INSTAGRAM_CALLBACK_ERROR:", err.message);
    const errorMessage = encodeURIComponent(err.message);
    return NextResponse.redirect(`${origin}/dashboard?error=${errorMessage}`);
  }
}