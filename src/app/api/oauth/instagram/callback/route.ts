import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // 1. Webhook Verification
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "my_secret_omni_token_123") {
    return new Response(challenge, { status: 200 });
  }

  // 2. OAuth Callback
  const code = searchParams.get("code");
  const state = searchParams.get("state"); 
  const nextPath = "/dir/accounts";

  if (code && state) {
    const supabase = await createClient();

    try {
      // A. Exchange code for Access Token
      // NOTE: For posting (Graph API), we usually hit graph.facebook.com
      const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token`, {
        method: "GET", // Facebook uses GET for this exchange
        params: new URLSearchParams({
          client_id: process.env.INSTAGRAM_APP_ID!,
          client_secret: process.env.INSTAGRAM_APP_SECRET!,
          redirect_uri: `${origin}/api/oauth/instagram/callback`, // MUST match your login button
          code: code,
        }),
      } as any);

      const tokenData = await tokenResponse.json();
      if (tokenData.error) throw new Error(tokenData.error.message);

      const shortLivedToken = tokenData.access_token;

      // B. Exchange for Long-Lived Access Token (60 days)
      const longLivedResponse = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.INSTAGRAM_APP_ID}&client_secret=${process.env.INSTAGRAM_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
      );
      
      const longLivedData = await longLivedResponse.json();
      const finalToken = longLivedData.access_token;

      // C. Save to your social_accounts table
      const { error: upsertError } = await supabase
        .from("social_accounts")
        .upsert({
          user_id: state, 
          platform: "instagram",
          access_token: finalToken,
          is_connected: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform' // Ensure you have a unique constraint on these two columns in Postgres
        });

      if (upsertError) throw upsertError;

      return NextResponse.redirect(`${origin}${nextPath}`);
    } catch (error) {
      console.error("Auth Error:", error);
      return NextResponse.redirect(`${origin}/login?error=Authentication+failed`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=No+code+provided`);
}