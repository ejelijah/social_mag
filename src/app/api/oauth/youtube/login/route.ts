import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 15,
  };

  cookieStore.set('youtube_code_verifier', codeVerifier, cookieOptions);
  cookieStore.set('youtube_oauth_state', state, cookieOptions);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.YOUTUBE_REDIRECT_URI!.trim(),
    response_type: 'code',
    scope: ['https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.profile',
    'openid',
    ].join(' '),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline', // CRITICAL: Gets you the refresh_token
    prompt: 'consent',     // CRITICAL: Forces Google to show the consent screen
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}