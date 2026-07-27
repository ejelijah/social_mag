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
    return NextResponse.redirect(new URL('/dashboard?error=invalid_state_or_code', request.url));
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User session not found");

    const { data: usernameData, error: usernameError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

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

    if (!response.ok) {
      throw new Error(`Google Token Exchange Failed: ${tokens.error_description || tokens.error || JSON.stringify(tokens)}`);
    }

    // Save to social_accounts
    // FIX: Changed onConflict to 'user_id, platform' to match the data you are sending
    const { error: upsertError } = await supabase
      .from('social_accounts')
      .upsert({
        platform: 'youtube',
        provider: 'youtube',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token, 
        is_connected: true,
        username: user.user_metadata?.youtube_username || usernameData, // Placeholder if username is not available
        updated_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }, { onConflict: 'user_id, platform' }); 

    if (upsertError) {
      throw new Error(`Database Upsert Failed: ${upsertError.message}`);
    }

    cookieStore.delete('youtube_oauth_state');
    cookieStore.delete('youtube_code_verifier');

    return NextResponse.redirect(new URL('/dir/create', request.url));
  } catch (error: any) {
    console.error('YouTube OAuth Error:', error);
    
    // This encodes the actual error message into the URL so you can read it in the browser
    const errorMessage = encodeURIComponent(error.message || 'Unknown Error');
    return NextResponse.redirect(new URL(`/dashboard?error=${errorMessage}`, request.url));
  }
}
