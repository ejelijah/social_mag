import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { upsertUserFromAuth } from "@/lib/users";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const nextPath = "/dir/accounts";

  console.log("DEBUG: Callback triggered from origin:", origin);

  // 1. Handle Webhook Verification (Keep this for Meta verification)
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "my_secret_omni_token_123") {
    console.log("DEBUG: Webhook verification successful.");
    return new Response(challenge, { status: 200 });
  }

  // 2. Handle Facebook OAuth Callback
  const code = searchParams.get("code");
  if (!code) {
    console.error("DEBUG: No code received in URL");
    return NextResponse.redirect(`${origin}/login?error=no_code_received`);
  }

  const supabase = await createClient();
  
  // A. Exchange code for session
  console.log("DEBUG: Exchanging code for session...");
  const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);
  
  if (authError) {
    console.error("DEBUG: Auth Exchange Failed:", authError.message);
    return new Response(JSON.stringify({ step: "Exchange Code", error: authError.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  if (data?.user && data?.session) {
    const user = data.user;
    const shortLivedToken = data.session.provider_token;
    
    console.log("DEBUG: User authenticated:", user.email);
    console.log("DEBUG: Provider token exists:", !!shortLivedToken);

    try {
      // B. Exchange for Long-Lived Token (60 days)
      console.log("DEBUG: Fetching long-lived token from Meta...");
      const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        fb_exchange_token: shortLivedToken!,
      });

      const response = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`
      );
      
      const tokenData = await response.json();
      
      if (tokenData.error) {
        console.error("DEBUG: Meta API Error:", tokenData.error.message);
        throw new Error(`Meta Token Error: ${tokenData.error.message}`);
      }

      const longLivedToken = tokenData.access_token || shortLivedToken;
      console.log("DEBUG: Long-lived token secured.");

      // C. Ensure user exists in primary users table
      console.log("DEBUG: Upserting user to primary table...");
      await upsertUserFromAuth(supabase, user);

      // D. Save to social_accounts table
      console.log("DEBUG: Saving to social_accounts table...");
      const { error: upsertError } = await supabase
        .from("social_accounts")
        .upsert({
          user_id: user.id,
          platform: "facebook", 
          provider: "facebook",
          access_token: longLivedToken,
          is_connected: true,
          updated_at: new Date().toISOString(),
          display_name: user.user_metadata.full_name,
          username: user.user_metadata.user_name || user.email,
          metadata: {
            avatar_url: user.user_metadata.avatar_url,
            facebook_user_id: user.user_metadata.provider_id
          },
        }, {
          onConflict: 'user_id,platform'
        });

      if (upsertError) {
        console.error("DEBUG: Database Save Failed:", upsertError.message);
        throw new Error(`Database Save Failed: ${upsertError.message}`);
      }

      console.log("DEBUG: Success! Redirecting to accounts...");
      return NextResponse.redirect(`${origin}${nextPath}`);

    } catch (err: any) {
      console.error("DEBUG: Catch Block Triggered:", err.message);
      // This will print the error directly on your screen so you can read it
      return new Response(JSON.stringify({ 
        message: "Process Failed", 
        error: err.message,
        stack: err.stack 
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }

  console.error("DEBUG: Session not found after exchange");
  return NextResponse.redirect(`${origin}/login?error=session_not_found`);
}