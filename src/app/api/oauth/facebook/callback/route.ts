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
    
    // 1. Check for User Session (Kept exactly like your example)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("User session not found. Please log in again.");
    }

    // 2. Exchange Code for Short-Lived Access Token
    // Using Facebook Graph API instead of Supabase Auth to prevent session switching
    const shortLivedParams = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      redirect_uri: `${origin}/api/oauth/facebook/callback`, 
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
      client_id: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      fb_exchange_token: shortLivedToken,
    });

    const longLivedRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${longLivedParams.toString()}`);

    const longLivedData = await longLivedRes.json();
    if (!longLivedRes.ok) throw new Error("Failed to upgrade to long-lived Facebook token.");

    const longLivedToken = longLivedData.access_token;

    // 4. Save to social_accounts
    // Note: Facebook does not provide a separate 'refresh_token'; the long-lived token is used instead.
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: user.id, // Links to the currently logged-in user
        platform: "facebook",
        access_token: longLivedToken,
        refresh_token: null, 
        is_connected: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) throw new Error(`Database Error: ${upsertError.message}`);

    // 5. Final Redirect to the Create Page
    return NextResponse.redirect(`${origin}${nextPath}`);

  } catch (err: any) {
    console.error("FACEBOOK_CALLBACK_ERROR:", err.message);
    const errorMessage = encodeURIComponent(err.message);
    return NextResponse.redirect(`${origin}/dashboard?error=${errorMessage}`);
  }
}
