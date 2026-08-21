// app/api/oauth/instagram/login/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const REDIRECT_URI =
  "https://omnipost.one/api/oauth/instagram/callback";

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

    // IMPORTANT:
    // This is the Instagram App ID shown under:
    // Instagram → API setup with Instagram login
    const instagramAppId = process.env.INSTAGRAM_APP_ID;

    if (!instagramAppId) {
      throw new Error(
        "INSTAGRAM_APP_ID is not configured."
      );
    }

    /*
     * Instagram Business Login permissions.
     *
     * These are the current Instagram Login scopes.
     */
    const scopes = [
      "instagram_business_basic",
      "instagram_business_content_publish",
    ].join(",");

    // CSRF protection
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: instagramAppId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scopes,
      state,

      // Optional, but useful while testing:
      force_reauth: "true",
    });

    /*
     * IMPORTANT:
     *
     * This is Instagram Business Login.
     *
     * It is NOT:
     * https://www.facebook.com/v20.0/dialog/oauth
     */
    const authUrl =
      `https://www.instagram.com/oauth/authorize?${params.toString()}`;

    const response = NextResponse.redirect(authUrl);

    response.cookies.set(
      "instagram_oauth_state",
      state,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      }
    );

    return response;
  } catch (error: any) {
    console.error(
      "INSTAGRAM_LOGIN_ERROR:",
      error
    );

    return NextResponse.redirect(
      `${origin}/dashboard?error=${encodeURIComponent(
        error?.message ||
          "Instagram login failed."
      )}`
    );
  }
}
