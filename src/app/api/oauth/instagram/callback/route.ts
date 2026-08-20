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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("User session not found.");

    // 1. Exchange Code for Short-Lived Facebook User Token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${process.env.FB_APP_ID}&redirect_uri=${encodeURIComponent(origin + '/api/oauth/instagram/callback')}&client_secret=${process.env.FB_APP_SECRET}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error?.message || "Token Exchange Failed");

    // 2. Upgrade to Long-Lived User Token (60 Days)
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FB_APP_ID}&client_secret=${process.env.FB_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedRes.json();
    const longLivedToken = longLivedData.access_token;

    // 3. Find the Instagram Business Account ID linked to the user's Pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v20.0/me/accounts?fields=instagram_business_account,name&access_token=${longLivedToken}`
    );
    const pagesData = await pagesRes.json();
    
    // We take the first page that has a linked Instagram Business Account
    const targetPage = pagesData.data?.find((p: any) => p.instagram_business_account);
    
    if (!targetPage) {
      throw new Error("No Instagram Business Account linked to your Facebook Pages found.");
    }

    const igBusinessId = targetPage.instagram_business_account.id;

    // 4. Upsert to social_accounts
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: user.id,
        platform: "instagram",
        provider: "facebook",
        access_token: longLivedToken,
        is_connected: true,
        expires_at: new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000).toISOString(),
        page_id: igBusinessId, // This is now the CORRECT Instagram Business ID
        username: targetPage.name,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) throw new Error(`Database Error: ${upsertError.message}`);

    return NextResponse.redirect(`${origin}${nextPath}`);

  } catch (err: any) {
    console.error("INSTAGRAM_CALLBACK_ERROR:", err.message);
    return NextResponse.redirect(`${origin}/dashboard?error=${encodeURIComponent(err.message)}`);
  }
}

