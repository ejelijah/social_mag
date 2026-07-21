import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server'; 

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('snap_auth_state')?.value;
  const codeVerifier = cookieStore.get('snap_code_verifier')?.value;

  // 1. Validation
  if (!code || !state || state !== storedState || !codeVerifier) {
    console.error('Debug: Validation failed', { code: !!code, stateMatch: state === storedState, verifier: !!codeVerifier });
    return NextResponse.redirect(new URL('/dashboard?error=auth_failed', request.url));
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // 2. Exchange Code for Token (Including the code_verifier)
    const response = await fetch('https://accounts.snapchat.com/accounts/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.SNAP_REDIRECT_URI!,
        client_id: process.env.SNAP_CLIENT_ID!,
        client_secret: process.env.SNAP_CLIENT_SECRET!,
        code_verifier: codeVerifier, // PKCE Verifier
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Snapchat API Error: ${errorData}`);
    }

    const tokens = await response.json();

    // 3. Save to Supabase
    await supabase.from('social_accounts').upsert({
      user_id: user.id,
      provider: 'snapchat',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      updated_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    }, { onConflict: 'user_id, provider_name' });
  
    // Cleanup cookies
    cookieStore.delete('snap_auth_state');
    cookieStore.delete('snap_code_verifier');

    return NextResponse.redirect(new URL('/dir/create', request.url));

  } catch (error: any) {
    console.error('OAuth Error:', error.message);
    return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent(error.message)}`, request.url));
  }
}
