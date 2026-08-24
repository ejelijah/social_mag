import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  const cookieStore = await cookies();

  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

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

  const authUrl = new URL("https://accounts.snapchat.com/accounts/oauth2/auth");
  authUrl.searchParams.set("client_id", process.env.SNAP_CLIENT_ID!.trim());
  authUrl.searchParams.set("redirect_uri", process.env.SNAP_REDIRECT_URI!);
  authUrl.searchParams.set("response_type", "code");
  
  // CRITICAL: Added snapchat-marketing-api to allow the 'post' functionality to work
  const scopes = [
    "https://auth.snapchat.com/oauth2/api/user.display_name",
    "https://auth.snapchat.com/oauth2/api/user.external_id",
    // Remove snapchat-marketing-api and try one of these if available:
    "https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar"
  ];
  
  authUrl.searchParams.set("scope", scopes.join(" "));
  
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(authUrl.toString());
}

