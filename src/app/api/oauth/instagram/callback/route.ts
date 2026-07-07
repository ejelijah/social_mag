import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const nextPath = "/dir/accounts";

  console.log("DEBUG: Instagram Callback triggered from origin:", origin);

  // 1. Webhook Verification (Keep for Meta)
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "my_secret_omni_token_123") {
    console.log("DEBUG: Instagram Webhook verified.");
    return new Response(challenge, { status: 200 });
  }

  // 2. OAuth Callback
  const code = searchParams.get("code");
  
  // We no longer rely on 'state' from the URL to avoid the bad_oauth_state error.
  // Instead, we get the user directly from the Supabase session.
  if (!code) {
    console.error("DEBUG: No code received in URL");
    return NextResponse.redirect(`${origin}/login?error=no_code_received`);
  }

  const supabase = await createClient();

  try {
    // A. Identify the User from the current session
    console.log("DEBUG: Identifying user from session...");
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("DEBUG: No active session found. User must be logged in to connect Instagram.");
      throw new Error("Session not found. Please log in to Omnipost again before connecting Instagram.");
    }

    const userId = user.id;
    console.log("DEBUG: User identified:", userId);

    // B. Exchange code for Short-Lived Access Token
    console.log("DEBUG: Exchanging Instagram code for short-lived token...");
    
    if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET) {
      throw new Error("Environment Variables MISSING: Check INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in Netlify.");
    }

    const params = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      redirect_uri: `${origin}/api/oauth/instagram/callback`,
      code: code,
    });

    const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`, {
      method: "GET",
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error("DEBUG: Meta Short-Lived Token Error:", tokenData.error.message);
      throw new Error(`Meta Short-Lived Error: ${tokenData.error.message}`);
    }

    const shortLivedToken = tokenData.access_token;
    console.log("DEBUG: Short-lived token received.");

    // C. Exchange for Long-Lived Access Token (60 days)
    console.log("DEBUG: Exchanging for 60-day long-lived token...");
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.INSTAGRAM_APP_ID}&client_secret=${process.env.INSTAGRAM_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
    );
    
    const longLivedData = await longLivedResponse.json();
    
    if (longLivedData.error) {
      console.error("DEBUG: Meta Long-Lived Token Error:", longLivedData.error.message);
      throw new Error(`Meta Long-Lived Error: ${longLivedData.error.message}`);
    }

    const finalToken = longLivedData.access_token;
    console.log("DEBUG: Long-lived token secured.");

    // D. Save to your social_accounts table
    console.log("DEBUG: Upserting to social_accounts for User:", userId);
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: userId,
        platform: "instagram",
        access_token: finalToken,
        is_connected: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) {
      console.error("DEBUG: Supabase Upsert Error:", upsertError.message);
      throw new Error(`Database Error: ${upsertError.message}`);
    }

    console.log("DEBUG: Success! Redirecting to accounts.");
    return NextResponse.redirect(`${origin}${nextPath}`);

  } catch (error: any) {
    console.error("DEBUG: Instagram Catch Block:", error.message);
    // Show the error as JSON in the browser window for debugging
    return new Response(JSON.stringify({ 
      message: "Instagram Process Failed", 
      error: error.message,
      stack: error.stack 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}