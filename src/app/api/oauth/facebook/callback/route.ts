import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { upsertUserFromAuth } from "@/lib/users";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const nextPath = "/dir/accounts";

  // 1. Handle Webhook Verification
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "my_secret_omni_token_123") {
    return new Response(challenge, { status: 200 });
  }

  // 2. Handle Facebook OAuth Callback
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code_received`);
  }

  const supabase = await createClient();
  
  // A. Exchange code for session
  const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);
  
  if (authError) {
    console.error("Auth Error:", authError.message);
    return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed&details=${encodeURIComponent(authError.message)}`);
  }

  if (data?.user && data?.session) {
    const user = data.user;
    const shortLivedToken = data.session.provider_token;
    
    try {
      // B. Exchange for Long-Lived Token (60 days)
      const response = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
      );
      
      const tokenData = await response.json();
      
      if (tokenData.error) {
        throw new Error(`Meta Token Error: ${tokenData.error.message}`);
      }

      const longLivedToken = tokenData.access_token || shortLivedToken;

      // C. Ensure user exists in primary users table
      try {
        await upsertUserFromAuth(supabase, user);
      } catch (e: any) {
        throw new Error(`User Upsert Failed: ${e.message}`);
      }

      // D. Save to social_accounts table
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
        throw new Error(`Database Save Failed: ${upsertError.message}`);
      }

      // SUCCESS REDIRECT
      return NextResponse.redirect(`${origin}${nextPath}`);

    } catch (err: any) {
      console.error("Callback Process Error:", err.message);
      // This sends the specific error message to your URL so you can read it in the browser
      return NextResponse.redirect(`${origin}${nextPath}?error=process_failed&details=${encodeURIComponent(err.message)}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=session_not_found`);
}