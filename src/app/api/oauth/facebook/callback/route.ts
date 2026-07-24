import { NextResponse } from "next/server";
import { upsertUserFromAuth } from "@/lib/users";
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const nextPath = "/dir/accounts";

  // 1. Handle Webhook Verification
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "my_secret_omni_token_123") {
    return new Response(challenge, { status: 200 });
  }

  // 2. Handle Facebook OAuth Callback
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code_received`);
  }

  // Standard client for Auth exchange
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ADMIN client to bypass RLS for syncing users and social accounts
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // This is the key that fixes the RLS error
  );
  
  const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);
  
  if (authError) {
    return new Response(JSON.stringify({ step: "Exchange Code", error: authError.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  if (data?.user && data?.session) {
    const user = data.user;
    const shortLivedToken = data.session.provider_token;
    
    try {
      // Exchange for Long-Lived User Token (60 days)
      const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        fb_exchange_token: shortLivedToken!,
      });

      const tokenResponse = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`
      );
      
      const tokenData = await tokenResponse.json();
      if (tokenData.error) throw new Error(`Meta Token Error: ${tokenData.error.message}`);

      const longLivedUserToken = tokenData.access_token;

      // Fetch Managed Pages
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedUserToken}`
      );
      
      const pagesData = await pagesResponse.json();
      if (pagesData.error) throw new Error(`Fetch Pages Error: ${pagesData.error.message}`);

      const pages = pagesData.data || [];
      
      if (pages.length === 0) {
        return new Response(JSON.stringify({ 
          message: "Business Account Required", 
          error: "No Facebook Pages found."
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const selectedPage = pages[0];
      const pageId = selectedPage.id;
      const pageAccessToken = selectedPage.access_token;

      // C. Sync user using ADMIN client to avoid RLS policy violation
      const { data: dbUser, error: dbError } = await upsertUserFromAuth(supabaseAdmin, user);
      
      if (dbError || !dbUser) {
        throw new Error(`Failed to sync user: ${dbError?.message}`);
      }
    
      // D. Save to social_accounts table using ADMIN client
      const { error: upsertError } = await supabaseAdmin
        .from("social_accounts")
        .upsert({          
          user_id: dbUser.id, // Ensure the user_id is mapped correctly here
          platform: "facebook", 
          provider: "facebook",
          access_token: pageAccessToken,
          page_id: pageId,
          is_connected: true,
          updated_at: new Date().toISOString(),
          display_name: selectedPage.name || user.user_metadata.full_name,
          username: user.user_metadata.user_name || user.email,
          metadata: {
            avatar_url: user.user_metadata.avatar_url,
            facebook_user_id: user.user_metadata.provider_id,
            page_name: selectedPage.name,
            category: selectedPage.category
          },
        }, {
          onConflict: 'user_id,platform'
        });
    
      if (upsertError) throw new Error(`Database Save Failed: ${upsertError.message}`);

      return NextResponse.redirect(`${origin}${nextPath}`);

    } catch (err: any) {
      return new Response(JSON.stringify({ 
        message: "Process Failed", 
        error: err.message 
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }

  return NextResponse.redirect(`${origin}/login?error=session_not_found`);
}