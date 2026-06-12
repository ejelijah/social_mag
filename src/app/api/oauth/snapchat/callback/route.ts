import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server'; 

export async function GET(request: Request) {
  console.log('--- Snapchat OAuth Callback Started ---');
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('snap_auth_state')?.value;

  console.log('--- DEBUGGING SNAPCHAT COOKIE ---');
  console.log('Is state present in cookies?:', !!storedState);

  // 1. Validation Checks
  if (!code) {
    console.error('Debug: No code found in URL');
    return NextResponse.redirect(new URL('/dashboard?error=no_code', request.url));
  }
  if (!state || state !== storedState) {
    console.error('Debug: State mismatch!', { received: state, stored: storedState });
    return NextResponse.redirect(new URL('/dashboard?error=state_mismatch', request.url));
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
    console.log('Debug: Attempting token exchange with Snapchat...');
    
    const response = await fetch('https://accounts.snapchat.com/login/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.SNAP_REDIRECT_URI!.trim(),
        client_id: process.env.SNAP_CLIENT_ID!,
        client_secret: process.env.SNAP_CLIENT_SECRET!,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Debug: Snapchat Token Exchange Failed:', errorData);
      throw new Error(`Snapchat API Error: ${errorData}`);
    }

    const tokens = await response.json();
    console.log('Debug: Snapchat tokens received successfully');

    // 4. Update Supabase
    // Note: updated_at is set to the current time plus the expiry seconds
    const { error: upsertError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: user.id,
        provider_name: 'snapchat',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        updated_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      }, { onConflict: 'user_id, provider_name' });
  
    if (upsertError) {
      console.error('Error details:', upsertError.message, upsertError.details);
      throw upsertError;
    }
    
    console.log('Debug: Database updated, cleaning up cookies and redirecting...');
    
    // Cleanup the state cookie
    cookieStore.delete('snap_auth_state');

    // 5. Final Redirect to the Create page
    return NextResponse.redirect(new URL('/api/create', request.url));

  } catch (error: any) {
    console.error('--- CRITICAL SNAPCHAT OAUTH ERROR ---');
    console.error(error.message);
    return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent(error.message)}`, request.url));
  }
}
