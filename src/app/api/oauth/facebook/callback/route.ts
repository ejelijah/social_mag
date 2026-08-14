import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.redirect(`${origin}/dashboard?error=no_code`);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Please log in.");

    // 1. Get Elijah's name for display
    const { data: profile } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .single();

    const displayUserName = profile?.name || "Elijah Ej";

    // 2. Exchange for User Token
    const tokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&redirect_uri=https://omnipost.one/api/oauth/facebook/callback&code=${code}`);
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error.message);

    // 3. CRITICAL: Get the Page ID and Page Token (Fixes the 'null' ID error)
    const pagesRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${tokenData.access_token}`);
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error("No Facebook Pages found. You need a Page to post.");
    }

    const page = pagesData.data[0];

    // 4. Save Page info and Elijah's Name
    const { error: dbError } = await supabase
      .from("social_accounts")
      .upsert({
        user_id: user.id,
        platform: "facebook",
        access_token: page.access_token, // Page-specific token
        page_id: page.id,               // Real Page ID (Fixes the null error)
        is_connected: true,
        display_name: page.name,        // Name of the Facebook Page
        username: displayUserName,      // Elijah's name from your database
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (dbError) throw new Error(dbError.message);

    return NextResponse.redirect(`${origin}/dir/create`);

  } catch (err: any) {
    return NextResponse.redirect(`${origin}/dashboard?error=${encodeURIComponent(err.message)}`);
  }
}

