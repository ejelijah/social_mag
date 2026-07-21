import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = `${origin}/api/oauth/tiktok/callback`;
  
  // Scopes required for OmniPost AI functionality
  const scopes = [
    "user.info.basic",
    "video.list",
    "user.info.stats",
    "user.info.profile"
  ].join(",");

  const tiktokAuthUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  tiktokAuthUrl.searchParams.set("client_key", clientKey!);
  tiktokAuthUrl.searchParams.set("scope", scopes);
  tiktokAuthUrl.searchParams.set("response_type", "code");
  tiktokAuthUrl.searchParams.set("redirect_uri", redirectUri);
  tiktokAuthUrl.searchParams.set("state", "tiktok_auth_state"); // In production, use a random string

  return NextResponse.redirect(tiktokAuthUrl.toString());
}