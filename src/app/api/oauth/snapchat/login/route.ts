import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  const cookieStore = await cookies();

  // 1. Generate State and PKCE Verifier
  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // 2. Store both in cookies
  cookieStore.set("snap_auth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  cookieStore.set("snap_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // 3. Build the URL with the correct scopes and PKCE challenge
  const authUrl = new URL("https://accounts.snapchat.com/accounts/oauth2/auth");
  authUrl.searchParams.set("client_id", process.env.SNAP_CLIENT_ID!.trim());
  authUrl.searchParams.set("redirect_uri", process.env.SNAP_REDIRECT_URI!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "user.display_name user.bitmoji.avatar"); // Fixed scopes
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(authUrl.toString());
}
