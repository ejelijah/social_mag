import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { upsertUserFromAuth } from "@/lib/users";
import { safeInternalPath } from "@/lib/safe-internal-path";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"), "/dashboard");

  if (code) {
    const supabase = await createClient();
    
    // 1. Exchange the code for a session
    // This session contains the 'provider_token' (Access Token) and 'provider_refresh_token'
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user && data.session) {
      const user = data.user;
      const session = data.session;
      
      // 2. Standard Auth: Ensure user exists in your 'users' table
      await upsertUserFromAuth(supabase, user);

      // 3. Social Account Sync: Save tokens to your 'social_accounts' table
      // Supabase identifies the provider (twitter, google, etc.) in app_metadata
      const provider = user.app_metadata.provider;

      if (provider && session.provider_token) {
        await supabase
          .from("social_accounts")
          .upsert({
            user_id: user.id,
            platform: provider, // matches your 'twitter', 'linkedin' logic
            provider: provider,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token || null,
            is_connected: true,
            updated_at: new Date().toISOString(),
            // Optional: Store extra info in metadata
            metadata: {
              full_name: user.user_metadata.full_name,
              avatar_url: user.user_metadata.avatar_url,
            },
          }, {
            onConflict: 'user_id,platform' // Uses your unique index
          });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=Could not authenticate user`);
}

