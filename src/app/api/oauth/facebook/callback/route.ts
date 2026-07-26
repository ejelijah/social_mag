import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  console.log("--- CALLBACK HIT ---");
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = "/dir/create";

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?error=no_code_received`);
  }

  try {
    const supabase = await createClient();
    
    // 1. Exchange the Supabase Code for a Session
    // This consumes the 'code' from the URL and logs the user in.
    // It also retrieves the Facebook Access Token (provider_token).
    const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (authError || !data.session) {
      throw new Error(`Supabase Auth Error: ${authError?.message || "Failed to exchange code for session"}`);
    }

    const user = data.session.user;
    const shortLivedToken = data.session.provider_token; // This is the Facebook token!

    if (!shortLivedToken) {
      throw new Error("Facebook provider token not found in session. Ensure Facebook login is configured correctly in Supabase.");
    }

    // 2. Exchange for Long-Lived Token (60 Days)
    // We take the token Supabase gave us and ask Facebook to make it last 60 days.
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      fb_exchange_token: shortLivedToken,
    });

    const longLivedRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${longLivedParams.toString()}`);
    const longLivedData = await longLivedRes.json();
    
    if (!longLivedRes.ok) {
      throw new Error(`Failed to upgrade to long-lived Facebook token: ${longLivedData.error?.message}`);
    }

    const longLivedToken = longLivedData.access_token;

    // 3. Identify the Facebook Account
    const fbProfileRes = await fetch(
      `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${longLivedToken}`
    );
    const fbProfile = await fbProfileRes.json();
    console.log("CONNECTING FACEBOOK ACCOUNT:", fbProfile.name, fbProfile.id);

    // 4. Save to social_accounts
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        // user_id: user.id, 
        platform: "facebook",
        access_token: longLivedToken,
        is_connected: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) throw new Error(`Database Error: ${upsertError.message}`);

    // 5. Final Redirect
    return NextResponse.redirect(`${origin}${nextPath}`);

  } catch (err: any) {
    const supabase = await createClient();
    await supabase.from("debug_logs").insert({ 
      error_message: err.message,
      timestamp: new Date().toISOString() 
    });

    console.error("FACEBOOK_CALLBACK_ERROR:", err.message);
    const errorMessage = encodeURIComponent(err.message);
    return NextResponse.redirect(`${origin}/dashboard?error=${errorMessage}`);
  }
}