import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('youtube_oauth_state')?.value;
  const codeVerifier = cookieStore.get('youtube_code_verifier')?.value;

  if (!code || state !== storedState || !codeVerifier) {
    return NextResponse.redirect(new URL('/dashboard?error=youtube_auth_failed', request.url));
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    // Exchange code for tokens
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.YOUTUBE_REDIRECT_URI!.trim(),
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    const tokens = await response.json();

    if (!response.ok) throw new Error(JSON.stringify(tokens));

    // Save to social_accounts
    const { error: upsertError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: user.id,
        provider_name: 'youtube',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token, // Google only sends this the FIRST time or if prompt=consent
        updated_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }, { onConflict: 'user_id, provider_name' });

    if (upsertError) throw upsertError;

    cookieStore.delete('youtube_oauth_state');
    cookieStore.delete('youtube_code_verifier');

    return NextResponse.redirect(new URL('app/create/page', request.url));
  } catch (error) {
    console.error('YouTube OAuth Error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=youtube_exchange_failed', request.url));
  }
}