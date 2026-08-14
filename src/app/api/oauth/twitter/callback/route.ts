import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server'; 

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('x_oauth_state')?.value;
  const codeVerifier = cookieStore.get('x_code_verifier')?.value;

  if (!code || state !== storedState || !codeVerifier) {
    return NextResponse.redirect(new URL('/dir/accounts?error=invalid_params', request.url));
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Fetch Elijah ej's name from the users table
    const { data: profile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const displayUserName = profile?.name || "Elijah ej";
    
    const basicAuth = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64');
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.X_REDIRECT_URI!.trim(),
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) throw new Error(`X API Error: ${await response.text()}`);
    const tokens = await response.json();

    const { error: upsertError } = await supabase
    .from('social_accounts')
    .upsert({
      user_id: user.id,
      platform: 'twitter',
      provider: 'twitter',
      is_connected: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      username: displayUserName, // Updated to use name from DB
      metadata: JSON.stringify(tokens),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,platform'
    });
  
    if (upsertError) throw upsertError;
    
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_code_verifier');

    return NextResponse.redirect(new URL('/dir/accounts', request.url));
  } catch (error: any) {
    return NextResponse.redirect(new URL(`/dir/accounts?error=${encodeURIComponent(error.message)}`, request.url));
  }
}



  