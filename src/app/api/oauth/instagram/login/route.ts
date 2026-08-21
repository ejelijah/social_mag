import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  // 1. Ensure user is logged in to Omnipost
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // 2. Construct the Instagram-Direct Login URL
  // 2. Construct the Facebook OAuth URL
  // We use Facebook Login because it is required to access the Instagram Graph API (Business)
  const clientID = process.env.FACEBOOK_APP_ID?.trim();
  
  if (!clientID) {
    return new Response("Error: INSTAGRAM_APP_ID is missing in environment variables", { status: 500 });
    return new Response("Error: FACEBOOK_APP_ID is missing in environment variables", { status: 500 });
  }

  const redirectUri = "https://omnipost.one/api/oauth/instagram/callback";

  // These are the "Business" scopes for Instagram
  // These are the specific scopes required to post content to Instagram Business/Creator accounts
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_insights",
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "public_profile"
  ].join(",");

  const instagramAuthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${clientID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&state=${user.id}`;
  // Use the Facebook dialog endpoint instead of the Instagram Basic endpoint
  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${clientID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${user.id}`;

  // 3. Redirect the user directly to Instagram
  return NextResponse.redirect(instagramAuthUrl);
  // 3. Redirect the user to Facebook to authorize the connection
  return NextResponse.redirect(authUrl);
}