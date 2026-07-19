import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { upsertUserFromAuth } from "@/lib/users";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const nextPath = "/dir/accounts";

  console.log("DEBUG: Callback triggered from origin:", origin);

  // 1. Handle Webhook Verification
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "my_secret_omni_token_123") {
    console.log("DEBUG: Webhook verification successful.");
    return new Response(challenge, { status: 200 });
  }

  // 2. Handle Facebook OAuth Callback
  const code = searchParams.get("code");
  if (!code) {
    console.error("DEBUG: No code received in URL");
    return NextResponse.redirect(`${origin}/login?error=no_code_received`);
  }

  const supabase = await createClient();
  
  console.log("DEBUG: Exchanging code for session...");
  const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);
  
  if (authError) {
    console.error("DEBUG: Auth Exchange Failed:", authError.message);
    return new Response(JSON.stringify({ step: "Exchange Code", error: authError.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  if (data?.user && data?.session) {
    const user = data.user;
    const shortLivedToken = data.session.provider_token;
    
    try {
      // B. Exchange for Long-Lived User Token (60 days)
      console.log("DEBUG: Fetching long-lived token from Meta...");
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

      // NEW STEP: Fetch Managed Pages to get real Page IDs and Page Access Tokens
      console.log("DEBUG: Fetching managed pages...");
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedUserToken}`
      );
      
      const pagesData = await pagesResponse.json();
      if (pagesData.error) throw new Error(`Fetch Pages Error: ${pagesData.error.message}`);

      const pages = pagesData.data || [];
      
      // ERROR HANDLING: If no business pages are found
      if (pages.length === 0) {
        console.error("DEBUG: No business pages found.");
        return new Response(JSON.stringify({ 
          message: "Business Account Required", 
          error: "We couldn't find any Facebook Pages associated with this account. Personal profiles cannot be used for posting. Please go back, create or switch to a Facebook Business Page, and try connecting again.",
          instructions: "1. Go to Facebook. 2. Ensure you have a Business Page created. 3. Make sure your personal account is an Admin of that page. 4. Try connecting again."
        }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Logic: Pick the first page found (In the future, you can let users choose)
      const selectedPage = pages[0];
      const pageId = selectedPage.id;
      const pageAccessToken = selectedPage.access_token; // This is the token needed to post as the page

      console.log("DEBUG: Page secured:", selectedPage.name);

      // C. Ensure user exists in primary users table
      await upsertUserFromAuth(supabase, user);

      // D. Save to social_accounts table
      console.log("DEBUG: Saving Page credentials to social_accounts...");
      const { error: upsertError } = await supabase
        .from("social_accounts")
        .upsert({
          user_id: user.id,
          platform: "facebook", 
          provider: "facebook",
          access_token: pageAccessToken, // We save the PAGE token, not the user token
          page_id: pageId,               // The real Page ID
          is_connected: true,
          updated_at: new Date().toISOString(),
          display_name: selectedPage.name || user.user_metadata.full_name,
          username: user.user_metadata.user_name || user.email,
          metadata: {
            avatar_url: user.user_metadata.avatar_url,
            facebook_user_id: user.user_metadata.provider_id, // Keep user ID for reference
            page_name: selectedPage.name,
            category: selectedPage.category
          },
        }, {
          onConflict: 'user_id,platform'
        });

      if (upsertError) throw new Error(`Database Save Failed: ${upsertError.message}`);

      console.log("DEBUG: Success! Redirecting to accounts...");
      return NextResponse.redirect(`${origin}${nextPath}`);

    } catch (err: any) {
      console.error("DEBUG: Catch Block Triggered:", err.message);
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