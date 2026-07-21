import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('snap_auth_state')?.value;
  const codeVerifier = cookieStore.get('snap_code_verifier')?.value;

  // 1. Validation with detailed error reporting
  let errorReason = "";
  if (!code) errorReason = "Missing authorization code from Snapchat";
  else if (!state) errorReason = "Missing state parameter";
  else if (state !== storedState) errorReason = "Security state mismatch (CSRF protection)";
  else if (!codeVerifier) errorReason = "Security verifier (PKCE) missing from session";

  if (errorReason) {
    console.error('Snapchat Auth Validation Failed:', { errorReason, state, storedState });
    return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent(errorReason)}`, request.url));
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("User session not found.");

    // 1. Ensure all variables are strings (prevents argument errors in URLSearchParams)
    const clientId = process.env.SNAP_CLIENT_ID || "";
    const clientSecret = process.env.SNAP_CLIENT_SECRET || "";
    const redirectUri = process.env.SNAP_REDIRECT_URI || "";

    if (!clientId || !redirectUri) {
      throw new Error("Missing SNAP_CLIENT_ID or SNAP_REDIRECT_URI in environment variables");
    }

    // 2. Use the CORRECT Snapchat token endpoint
    const response = await fetch('https://accounts.snapchat.com/login/oauth2/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier as string, // Required for PKCE
      }),
    });

    // 3. Handle non-JSON responses (prevents parsing errors)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textError = await response.text();
      throw new Error(`Snapchat returned non-JSON response: ${textError.substring(0, 100)}`);
    }

    const tokens = await response.json();

    if (!response.ok) {
      throw new Error(tokens.error_description || tokens.error || "Snapchat token exchange failed");
    }

    // 4. Save to Supabase
    const { error: upsertError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: user.id,
        platform: 'snapchat',
        provider: 'snapchat',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        is_connected: true,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        username: "Snapchat User", 
      }, { 
        onConflict: 'user_id,platform' 
      });

    if (upsertError) throw new Error(`Database Error: ${upsertError.message}`);
  
    cookieStore.delete('snap_auth_state');
    cookieStore.delete('snap_code_verifier');

    return NextResponse.redirect(new URL('/dir/create', request.url));

  } catch (error: any) {
    console.error('Snapchat OAuth Error:', error.message);
    return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent(error.message)}`, request.url));
  }
}