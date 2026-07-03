import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  // 1. Fetch the user's ID to pass as 'state' 
  // This ensures we know which account to link when they come back
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=session_expired`);
  }

  // 2. Initiate the OAuth flow
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook", // Instagram Business uses the Facebook provider in Supabase
    options: {
      // Must match your Instagram callback folder exactly
      redirectTo: `${origin}/api/oauth/instagram/callback`, 
      scopes: "public_profile,email,instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
      queryParams: {
        // We pass the user ID in the state so the callback can save the token to the right user
        state: user.id 
      }
    },
  });

  if (error) {
    console.error("OAuth Error:", error.message);
    return NextResponse.redirect(`${origin}/dashboard/accounts?error=${encodeURIComponent(error.message)}`);
  }

  // 3. Redirect the user to the Meta/Instagram authorization page
  return NextResponse.redirect(data.url);
}
