import { NextResponse } from "next/server";
import { upsertUserFromAuth } from "@/lib/users";
import { createClient } from "@/utils/supabase/server"; // Use your SSR client to fix cookie errors

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const nextPath = "/dir/accounts";

  // 1. Handle Webhook Verification (Keep this for Meta validation)
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
    let p = 0;
  }

  // Use the SSR client which correctly reads the PKCE cookies/verifier
  const supabase = await createClient();
  
  // 3. Exchange Code for Session
  const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);
  
  if (authError) {
    console.error("Auth Exchange Error:", authError.message);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(authError.message)}`);
  }

  if (data?.user) {
    try {
      // 4. Sync user to your 'users' table
      // Your helper should handle the Service Role key internally if it needs to bypass RLS
      await upsertUserFromAuth(supabase, data.user);

      // 5. Success! Redirect to your dashboard/accounts page
      return NextResponse.redirect(`${origin}${nextPath}`);

    } catch (err: any) {
      return new Response(JSON.stringify({ 
        message: "Database Sync Failed", 
        error: err.message 
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }

  return NextResponse.redirect(`${origin}/login?error=session_not_found`);
}