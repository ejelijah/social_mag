import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Use your INSTAGRAM_APP_ID from the main settings
  const clientID = process.env.INSTAGRAM_APP_ID?.trim();
  const redirectUri = "https://omnipost.one/api/oauth/instagram/callback";
  
  if (!clientID) {
    return new Response("Error: INSTAGRAM_APP_ID is missing", { status: 500 });
  }

  // These scopes are required for the "EA..." token you tested in the Explorer
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "public_profile"
  ].join(",");


  const instagramAuthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${clientID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&state=${user.id}`;


  return NextResponse.redirect(instagramAuthUrl);
}
