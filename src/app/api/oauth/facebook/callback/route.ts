import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { metadata } from "@/app/layout";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  
  // FIX 1: Stop Netlify/Next.js from "pre-fetching" and killing the code
  if (request.headers.get("purpose") === "prefetch") {
    return new Response(null, { status: 204 });
  }

  // FIX 2: Hardcode your production domain to avoid Netlify URL mismatches
  const REDIRECT_URI = "https://omnipost.one/api/oauth/facebook/callback";

  if (!code) {
    return NextResponse.redirect("https://omnipost.one/dashboard?error=no_code");
  }

  try {
    const supabase = await createClient();

    // 1. Get the current user BEFORE we talk to Facebook
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("User not found. Please log in again.");

    console.log("DEBUG: Exchanging code for user:", user.id);

    // 2. Manual POST exchange (Bypassing Supabase Auth to stop the "Glitch")
    const tokenResponse = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        redirect_uri: REDIRECT_URI, // MUST MATCH META DASHBOARD EXACTLY
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("META API ERROR:", tokenData.error);
      throw new Error(`Facebook Error: ${tokenData.error.message}`);
    }

    const accessToken = tokenData.access_token;

    // 3. Get the Facebook Profile
    const fbProfileRes = await fetch(`https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${accessToken}`);
    const fbProfile = await fbProfileRes.json();

    // 4. Upsert into your table using the ORIGINAL User ID (Prevents the Overwrite)
    const { error: dbError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: user.id, // This ensures the account links to the right person
        platform: "facebook",
        access_token: accessToken,
        is_connected: true,
        display_name: fbProfile.name,
        username: fbProfile.name,
        metadata: JSON.stringify(fbProfile),
        page_id: fbProfile.id,
        expiers_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        provider: "facebook",
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (dbError) throw new Error(dbError.message);

    return NextResponse.redirect("https://omnipost.one/dir/create");

  } catch (err: any) {
    console.error("CRITICAL ERROR:", err.message);
    return NextResponse.redirect(`https://omnipost.one/dashboard?error=${encodeURIComponent(err.message)}`);
  }
}