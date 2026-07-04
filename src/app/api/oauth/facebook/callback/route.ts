import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { upsertUserFromAuth } from "@/lib/users";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // 1. Handle Webhook Verification (Meta Dashboard "Verify and Save")
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "my_secret_omni_token_123") {
    return new Response(challenge, { status: 200 });
  }

  // 2. Handle Facebook OAuth Callback
  const code = searchParams.get("code");
  const nextPath = "/dir/accounts";

  if (code) {
    const supabase = await createClient();
    
    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user && data.session) {
      const user = data.user;
      const shortLivedToken = data.session.provider_token;
      
      try {
        // --- CRITICAL STEP FOR POSTING: Exchange for Long-Lived Token (60 days) ---
        const response = await fetch(
          `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
        );
        
        const tokenData = await response.json();
        const longLivedToken = tokenData.access_token || shortLivedToken;

        // Ensure user exists in primary users table
        await upsertUserFromAuth(supabase, user);

        // Save the LONG-LIVED token to your social_accounts table
        const { error: upsertError } = await supabase
          .from("social_accounts")
          .upsert({
            user_id: user.id,
            platform: "facebook", 
            provider: "facebook",
            access_token: longLivedToken, // Use the 60-day token here
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

        if (upsertError) throw upsertError;

        return NextResponse.redirect(`${origin}${nextPath}`);

      } catch (err) {
        console.error("Token Exchange Error:", err);
        return NextResponse.redirect(`${origin}/dir/accounts?error=token_exchange_failed`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication+failed`);
}