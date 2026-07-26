import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = "/dir/create";

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?error=no_code_received`);
  }

  try {
    const supabase = await createClient();
    
    // 1. Check for User Session
    // If this fails, it means you aren't logged into your app when you try to connect.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("User session not found. Please log in to Omnipost first.");
    }

    // 2. Exchange Code for Short-Lived Access Token
    const shortLivedParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      redirect_uri: "https://omnipost.one/api/oauth/facebook/callback", 
      code: code,
    });

    const shortLivedRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${shortLivedParams.toString()}`);
    const shortLivedData = await shortLivedRes.json();
    
    if (!shortLivedRes.ok) {
      throw new Error(`Facebook Exchange Failed: ${shortLivedData.error?.message || "Invalid Secret or Code"}`);
    }

    const shortLivedToken = shortLivedData.access_token;

    // 3. Exchange for Long-Lived Token (60 Days)
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      fb_exchange_token: shortLivedToken,
    });

    const longLivedRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${longLivedParams.toString()}`);
    const longLivedData = await longLivedRes.json();
    if (!longLivedRes.ok) throw new Error("Failed to upgrade to long-lived Facebook token.");

    const longLivedToken = longLivedData.access_token;

    // 4. Identify the Facebook Account (CRITICAL FOR DEBUGGING)
    const fbProfileRes = await fetch(
      `https://graph.facebook.com/v20.0/me?fields=id,name,email&access_token=${longLivedToken}`
    );
    const fbProfile = await fbProfileRes.json();

    // THIS LOG WILL SHOW YOU EXACTLY WHICH ACCOUNT IS CONNECTING
    console.log("CONNECTING FACEBOOK ACCOUNT:", fbProfile.name, fbProfile.id);

    // 5. Save to social_accounts
    // I removed the platform_user_id and platform_user_name since you said you don't have them.
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: user.id, 
        platform: "facebook",
        access_token: longLivedToken,
        is_connected: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) throw new Error(`Database Error: ${upsertError.message}`);

    // 6. Final Redirect
    return NextResponse.redirect(`${origin}${nextPath}`);

  } catch (err: any) {
    console.error("FACEBOOK_CALLBACK_ERROR:", err.message);
    const errorMessage = encodeURIComponent(err.message);
    return NextResponse.redirect(`${origin}/dashboard?error=${errorMessage}`);
  }
}