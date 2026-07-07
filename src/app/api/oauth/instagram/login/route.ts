import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  // Ensure this matches your Supabase Redirect Allow List exactly
  const redirectUri = `${origin}/api/oauth/instagram/callback`;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook", 
    options: {
      redirectTo: redirectUri, 
      scopes: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
      queryParams: {
        // REMOVED 'state: user.id' to let Supabase handle security
        auth_type: 'rerequest' 
      }
    },
  });

  if (error) return NextResponse.redirect(`${origin}/dashboard/accounts?error=${encodeURIComponent(error.message)}`);
  return NextResponse.redirect(data.url);
}