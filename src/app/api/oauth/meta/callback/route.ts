import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { upsertUserFromAuth } from "@/lib/users";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    
    // Exchange code for session to get provider tokens
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user && data.session) {
      const user = data.user;
      const session = data.session;
      
      // Ensure user exists in primary users table
      await upsertUserFromAuth(supabase, user);

      // Save Meta tokens to social_accounts table
      const { error: upsertError } = await supabase
        .from("social_accounts")
        .upsert({
          user_id: user.id,
          platform: "facebook",
          provider: "facebook",
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token || null,
          is_connected: true,
          updated_at: new Date().toISOString(),
          display_name: user.user_metadata.full_name,
          username: user.user_metadata.user_name || user.email,
          metadata: {
            avatar_url: user.user_metadata.avatar_url,
          },
        }, {
          onConflict: 'user_id,platform'
        });

      if (upsertError) {
        return NextResponse.redirect(`${origin}/dashboard/accounts?error=db_sync_failed`);
      }

      return NextResponse.redirect(`${origin}/dashboard/accounts?success=meta_connected`);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard/accounts?error=auth_failed`);
}