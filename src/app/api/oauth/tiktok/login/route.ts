import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirect_uri = "https://omnipost.one/api/oauth/tiktok/callback";
  
  // Scopes required for OmniPost AI functionality
  // Added "video.publish" and "video.upload" for full posting capabilities
  const scopes = [
    "user.info.basic",
    "video.list",
    "user.info.stats",
    "user.info.profile",
    "video.publish",
    "video.upload"
  ].join(",");

  const tiktokAuthUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  tiktokAuthUrl.searchParams.set("client_key", clientKey!);
  tiktokAuthUrl.searchParams.set("scope", scopes);
  tiktokAuthUrl.searchParams.set("response_type", "code");
  tiktokAuthUrl.searchParams.set("redirect_uri", redirect_uri);
  tiktokAuthUrl.searchParams.set("state", "tiktok_auth_state"); 

  return NextResponse.redirect(tiktokAuthUrl.toString());
}
