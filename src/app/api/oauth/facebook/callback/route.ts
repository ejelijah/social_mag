import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  console.log("--- FACEBOOK CALLBACK HIT ---");
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = "/dir/create";

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?error=no_code_received`);
  }

  try {
    const supabase = await createClient();

    // 1. MANUALLY exchange the code for a Facebook Access Token
    // We do NOT use supabase.auth.exchangeCodeForSession here.
    // This keeps the original user logged in and prevents the "glitch".
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${origin}/api/oauth/facebook/callback&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(`Facebook Token Error: ${tokenData.error.message}`);
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange for Long-Lived Token (60 Days)
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      fb_exchange_token: shortLivedToken,
    });

    const longLivedRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${longLivedParams.toString()}`);
    const longLivedData = await longLivedRes.json();
    
    if (!longLivedRes.ok) {
      throw new Error(`Failed to upgrade token: ${longLivedData.error?.message}`);
    }

    const longLivedToken = longLivedData.access_token;

    // 3. Identify the Facebook Account
    const fbProfileRes = await fetch(
      `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${longLivedToken}`
    );
    const fbProfile = await fbProfileRes.json();

    // 4. Save to social_accounts
    // Your SQL function will now work perfectly because auth.uid() 
    // still points to your ORIGINAL user.
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