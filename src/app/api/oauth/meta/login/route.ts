import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${origin}/api/auth/meta/callback`,
      scopes: "public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",
    },
  });

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard/accounts?error=${error.message}`);
  }

  return NextResponse.redirect(data.url);
}