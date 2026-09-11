import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  
  // Ensure this EXACT URL is registered in your TikTok Developer Portal
  const redirect_uri = "https://omnipost.one/api/oauth/tiktok/callback";
  
  // Essential scopes for the V2 Content Posting API
  // "video.publish" is the critical scope for your Edge Function to work
  const scopes = [
    "user.info.basic",
    "user.info.profile",
    "user.info.stats",
    "video.list",
    "video.publish",
    "video.upload"
  ].join(",");

  const tiktokAuthUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  
  tiktokAuthUrl.searchParams.set("client_key", clientKey!);
  tiktokAuthUrl.searchParams.set("scope", scopes);
  tiktokAuthUrl.searchParams.set("response_type", "code");
  tiktokAuthUrl.searchParams.set("redirect_uri", redirect_uri);
  
  // Using a static state for now, but ensure this matches what your callback expects
  tiktokAuthUrl.searchParams.set("state", "tiktok_auth_state"); 

  return NextResponse.redirect(tiktokAuthUrl.toString());
}
