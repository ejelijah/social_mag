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
    
    // 1. Get User Session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("User session not found.");

    // 2. Fetch Elijah's name from your 'users' table
    // Removed the space in "users" and selected "name"
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .single();

    const displayUserName = profile?.name || "Elijah Ej";

    // 3. Exchange Code for Token
    const shortLivedParams = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: "https://omnipost.one/api/oauth/instagram/callback", 
      code: code,
    });

    const shortLivedRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: shortLivedParams,
    });

    const shortLivedData = await shortLivedRes.json();
    if (!shortLivedRes.ok) throw new Error(shortLivedData.error_message || "Exchange Failed");

    // 4. Upgrade to Long-Lived Token (60 Days)
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortLivedData.access_token}`
    );
    const longLivedData = await longLivedRes.json();

    // 5. Save to social_accounts
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: user.id, // Added this back in
        platform: "instagram",
        provider: "instagram",
        access_token: longLivedData.access_token,
        is_connected: true,
        expires_at: new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000).toISOString(),
        page_id: shortLivedData.user_id, // This is the Instagram Account ID
        username: displayUserName, // Now shows Elijah Ej instead of an ID
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (upsertError) throw new Error(`Database Error: ${upsertError.message}`);

    return NextResponse.redirect(`${origin}${nextPath}`);

  } catch (err: any) {
    console.error("INSTAGRAM_ERROR:", err.message);
    return NextResponse.redirect(`${origin}/dashboard?error=${encodeURIComponent(err.message)}`);
  }
}
