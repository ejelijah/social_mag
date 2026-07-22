import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server'; 

export async function GET(request: Request) {
  console.log('--- OAuth Callback Started ---');
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('x_oauth_state')?.value;
  const codeVerifier = cookieStore.get('x_code_verifier')?.value;

  console.log('--- DEBUGGING COOKIE ---');
  console.log('Is verifier present?:', !!codeVerifier);
  console.log('Verifier Value:', codeVerifier);

  // 1. Check if we have the necessary data from X and the cookies
  if (!code) {
    console.error('Debug: No code found in URL');
    return NextResponse.redirect(new URL('/dir/accounts?error=no_code', request.url));
  }
  if (state !== storedState) {
    console.error('Debug: State mismatch!', { received: state, stored: storedState });
    return NextResponse.redirect(new URL('/dir/accounts?error=state_mismatch', request.url));
  }
  if (!codeVerifier) {
    console.error('Debug: No code_verifier cookie found');
    return NextResponse.redirect(new URL('/dir/accounts?error=no_verifier', request.url));
  }

  try {
    const supabase = await createClient();
    
    // 2. Check Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Debug: Supabase user not found', userError);
      throw new Error("User not authenticated");
    }
    console.log('Debug: Authenticated user ID:', user.id);

    // 3. Exchange Code for Token
    console.log('Debug: Attempting token exchange with X...');
    
    const basicAuth = Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString('base64');
  
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

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Debug: X Token Exchange Failed:', errorData);
      throw new Error(`X API Error: ${errorData}`);
    }

    const tokens = await response.json();
    console.log('Debug: Tokens received successfully');

    // 4. Update Supabase
    const { error: upsertError } = await supabase
    .from('social_accounts')
    .upsert({
      platform: 'twitter',
      is_connected: true, // Changed to snake_case to match standard DB practice

      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,platform' // Ensures it updates the existing row for this user/platform
    });
  
    if (upsertError) {
      console.error('Error details:', upsertError.message);
      throw upsertError;
    }
    
    console.log('Debug: Database updated, cleaning up cookies and redirecting...');
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_code_verifier');

    // Redirecting to the Accounts page as requested
    return NextResponse.redirect(new URL('/dir/accounts', request.url));

  } catch (error: any) {
    console.error('--- CRITICAL OAUTH ERROR ---');
    console.error(error.message);
    return NextResponse.redirect(new URL(`/dir/accounts?error=${encodeURIComponent(error.message)}`, request.url));
  }
}



  