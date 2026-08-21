import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Use the ID you provided: 27358157757197926
  const clientID = "27358157757197926"; 
  const redirectUri = "https://omnipost.one/api/oauth/instagram/callback";
  
  // These are the "Business" scopes that allow posting. 
  // These will NOT work with api.instagram.com
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "public_profile"
  ].join(",");

  // This URL MUST be facebook.com to get a posting token
  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${clientID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${user.id}`;

  return NextResponse.redirect(authUrl);
}
