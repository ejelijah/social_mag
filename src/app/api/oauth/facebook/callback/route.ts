import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  console.log("--- FACEBOOK CALLBACK HIT (POST METHOD) ---");
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = "/dir/create";

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?error=no_code_received`);
  }

  try {
    const supabase = await createClient();

    // 1. Exchange the code for a Short-Lived Access Token using POST
    // This bypasses Supabase Auth to prevent the session "glitch"
    const shortLivedParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      redirect_uri: `${origin}/api/oauth/facebook/callback`,
      code: code,
    });

    const tokenResponse = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token`, {
      method: "POST",
      body: shortLivedParams,
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(`Facebook Short-Lived Token Error: ${tokenData.error.message}`);
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange for Long-Lived Token (60 Days) using POST
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      fb_exchange_token: shortLivedToken,
    });

    const longLivedRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token`, {
      method: "POST",
      body: longLivedParams,
    });

    const longLivedData = await longLivedRes.json();
    
    if (!longLivedRes.ok) {
      throw new Error(`Failed to upgrade to long-lived token: ${longLivedData.error?.message}`);
    }

    const longLivedToken = longLivedData.access_token;

    // 3. Identify the Facebook Account
    const fbProfileRes = await fetch(
      `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${longLivedToken}`
    );
    const fbProfile = await fbProfileRes.json();

    // 4. Save to social_accounts
    // Because we didn't use supabase.auth, the current session is preserved.
    // Your SQL function will correctly use the original user's ID.
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        platform: "facebook",
        access_token: longLivedToken,
        is_connected: true,
        display_name: fbProfile.name,
        username: fbProfile.id,
        provider: "facebook",
        metadata: JSON.stringify(fbProfile),
        page_id: fbProfile.id,
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'platform'
      });

    if (upsertError) throw new Error(`Database Error: ${upsertError.message}`);

    return NextResponse.redirect(`${origin}${nextPath}`);

  } catch (err: any) {
    console.error("FACEBOOK_CALLBACK_ERROR:", err.message);
    const errorMessage = encodeURIComponent(err.message);
    return NextResponse.redirect(`${origin}/dashboard?error=${errorMessage}`);
  }
}