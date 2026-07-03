import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // 1. Handle Webhook Verification (Meta Dashboard "Verify and Save" button)
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "my_secret_omni_token_123") {
    // Return the challenge as plain text to verify the webhook
    return new Response(challenge, { status: 200 });
  }

  // 2. Handle OAuth Callback (When a user connects their account)
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // This is the Supabase User ID passed from the login button

  if (code && state) {
    const supabase = await createClient();

    try {
      // A. Exchange code for Short-Lived Access Token (valid for 1-2 hours)
      const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: process.env.INSTAGRAM_APP_ID!,
          client_secret: process.env.INSTAGRAM_APP_SECRET!,
          grant_type: "authorization_code",
          redirect_uri: `${origin}/api/oauth/instagram`, // Must match exactly what's in Meta portal
          code: code,
        }),
      });

      const tokenData = await tokenResponse.json();
      if (tokenData.error) throw new Error(tokenData.error_message);

      const shortLivedToken = tokenData.access_token;
      const instagramUserId = tokenData.user_id;

      // B. Exchange for Long-Lived Access Token (valid for 60 days)
      const longLivedResponse = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`
      );
      
      const longLivedData = await longLivedResponse.json();
      const finalToken = longLivedData.access_token;

      // C. Save the token to your social_accounts table
      const { error: upsertError } = await supabase
        .from("social_accounts")
        .upsert({
          user_id: state, // Using the ID we passed in 'state'
          platform: "instagram",
          provider: "instagram",
          access_token: finalToken,
          is_connected: true,
          updated_at: new Date().toISOString(),
          metadata: {
            instagram_user_id: instagramUserId,
          },
        }, {
          onConflict: 'user_id,platform'
        });

      if (upsertError) throw upsertError;

      // Success redirect
      return NextResponse.redirect(`${origin}/dashboard/accounts?success=instagram_connected`);
    } catch (error) {
      console.error("Instagram Auth Error:", error);
      return NextResponse.redirect(`${origin}/dashboard/accounts?error=token_exchange_failed`);
    }
  }

  // Fallback if neither verification nor code is present
  return NextResponse.redirect(`${origin}/dashboard/accounts?error=auth_failed`);
}