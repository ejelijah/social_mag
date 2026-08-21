// app/api/oauth/instagram/login/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  try {
    const supabase = await createClient();

    // Make sure the OmniPost user is logged in.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.redirect(
        `${origin}/dashboard?error=not_authenticated`
      );
    }

    const appId = process.env.FACEBOOK_APP_ID;

    if (!appId) {
      throw new Error("INSTAGRAM_APP_ID is not configured.");
    }

    const redirectUri =
      "https://omnipost.one/api/oauth/instagram/callback";

    /*
     * Facebook Login for Business / Instagram Business accounts.
     *
     * The exact permissions available to your Meta app depend on the
     * products and permissions enabled in the Meta Developer dashboard.
     */
    const scopes = [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
    ].join(",");

    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      state,
    });

    const authUrl =
      `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;


    const response = NextResponse.redirect(authUrl);

    /*
     * Store the OAuth state so the callback can verify that the request
     * actually originated from this login attempt.
     *
     * This cookie is short-lived and cannot be accessed by client-side JS.
     */
    response.cookies.set("instagram_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("INSTAGRAM_LOGIN_ERROR:", error);

    return NextResponse.redirect(
      `${origin}/dashboard?error=${encodeURIComponent(
        error?.message || "Instagram login failed"
      )}`
    );
  }
}

