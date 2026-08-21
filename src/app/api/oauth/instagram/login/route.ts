import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Use the ID you provided: 27358157757197926
  const clientID = "1375168544485480"; 
  const redirectUri = encodeURIComponent("https://omnipost.one/api/oauth/instagram/callback");
  
  // These are the specific permissions (scopes) for posting images and videos
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "public_profile"
  ].join(",");
  
  // The correct Facebook Login URL
  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${clientID}&redirect_uri=${redirectUri}&scope=${scopes}&response_type=code`;
}
