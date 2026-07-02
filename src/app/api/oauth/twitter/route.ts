import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeAndSaveXTokens } from './x';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = cookies();
  const storedState = cookieStore.get('x_oauth_state')?.value;
  const codeVerifier = cookieStore.get('x_code_verifier')?.value;

  if (!code || state !== storedState || !codeVerifier) {
    return NextResponse.redirect(new URL('/dashboard?error=invalid_session', request.url));
  }

  try {
    await exchangeAndSaveXTokens(code, codeVerifier);
    
    // Cleanup security cookies
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_code_verifier');

    // Redirect to your scheduling page
    return NextResponse.redirect(new URL('/dashboard/schedule', request.url));
  } catch (error) {
    console.error('X OAuth Error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', request.url));
  }
}