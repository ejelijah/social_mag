import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function exchangeAndSaveXTokens(code: string, codeVerifier: string) {
  const cookieStore = cookies();
  
  // Initialize Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: any) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  );

  // 1. Exchange Code for Tokens
  const basicAuth = Buffer.from(
    `${process.env.NEXT_PUBLIC_X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.NEXT_PUBLIC_X_REDIRECT_URI!,
      code_verifier: codeVerifier,
    }),
  });

  const tokens = await response.json();
  if (!response.ok) throw new Error(tokens.error_description || 'Token exchange failed');

  // 2. Get X User Details
  const userRes = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const { data: xUser } = await userRes.json();

  // 3. Get Current Supabase User
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated in Supabase');

  // 4. Upsert into social_accounts
  const { error } = await supabase
    .from('social_accounts')
    .upsert({
      user_id: user.id,
      platform: 'x',
      platform_user_id: xUser.id,
      platform_username: xUser.username,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: 'user_id, platform' });

  if (error) throw error;

  return { success: true };
}