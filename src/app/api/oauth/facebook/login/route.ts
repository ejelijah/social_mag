import { NextResponse } from "next/server";
export async function GET(request: Request) {
const { origin } = new URL(request.url);
// 1. Define your credentials
const clientID = process.env.FACEBOOK_APP_ID;
// 2. Hardcode the Redirect URI to ensure it matches your Meta Dashboard 100%
const redirectUri = "https://omnipost.one/api/oauth/facebook/callback";
// 3. Define the scopes (Permissions)
const scopes = [
"public_profile",
"email",
"pages_show_list",
"pages_read_engagement",
"pages_manage_posts"
].join(",");
// 4. Construct the DIRECT Facebook Login URL
// This bypasses Supabase Auth so it won't "steal" your session or the code.
const facebookAuthUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
facebookAuthUrl.searchParams.set("client_id", clientID!);
facebookAuthUrl.searchParams.set("redirect_uri", redirectUri);
facebookAuthUrl.searchParams.set("response_type", "code");
facebookAuthUrl.searchParams.set("scope", scopes);
// 5. Send the user straight to Facebook
return NextResponse.redirect(facebookAuthUrl.toString());
}