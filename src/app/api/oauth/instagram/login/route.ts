import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  // 1. Ensure user is logged in to Omnipost
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // 2. Construct the Instagram-Direct Login URL
  const clientID = process.env.INSTAGRAM_APP_ID;
  if (!clientID) {
    return new Response("Error: INSTAGRAM_APP_ID is missing in environment variables", { status: 500 });
  }
  const redirectUri = "https://omnipost.one/api/oauth/instagram/callback";
  
  // These are the "Business" scopes for Instagram
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_insights"
  ].join(",");

  const instagramAuthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${clientID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&state=${user.id}`;

  // 3. Redirect the user directly to Instagram
  return NextResponse.redirect(instagramAuthUrl);
}
