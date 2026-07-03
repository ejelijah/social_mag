import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook", 
    options: {
      // THIS MUST POINT TO INSTAGRAM CALLBACK
      redirectTo: `${origin}/api/oauth/instagram/callback`, 
      // These scopes force the "Select Instagram Account" screen to appear
      scopes: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
      queryParams: {
        state: user.id,
        // This forces the user to see the permission screen again 
        // useful for testing to make sure you see the Instagram options
        auth_type: 'rerequest' 
      }
    },
  });

  if (error) return NextResponse.redirect(`${origin}/dashboard/accounts?error=${error.message}`);
  return NextResponse.redirect(data.url);
}
