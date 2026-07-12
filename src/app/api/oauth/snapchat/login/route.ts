import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
export async function GET() {
const state = crypto.randomBytes(16).toString("hex");
const cookieStore = await cookies();
// Store state in a cookie
cookieStore.set("snap_auth_state", state, {
    httpOnly: true,
    secure: true, 
    sameSite: "lax", // Lax is required for cross-site redirects
    path: "/",       // Make sure this is set to '/'
    maxAge: 600,
  });
const authUrl = new URL("https://accounts.snapchat.com/login/oauth2/authorize");
    authUrl.searchParams.set("client_id", process.env.SNAP_CLIENT_ID!.trim());
    authUrl.searchParams.set("redirect_uri", process.env.SNAP_REDIRECT_URI!);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "user.display_name user.bitmoji.avatar");
    authUrl.searchParams.set("state", state);
    return NextResponse.redirect(authUrl.toString());
}