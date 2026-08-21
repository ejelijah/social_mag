// app/api/oauth/instagram/callback/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const REDIRECT_URI =
  "https://omnipost.one/api/oauth/instagram/callback";

export async function GET(request: Request) {
  const { searchParams, origin } =
    new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const oauthError =
    searchParams.get("error");

  const oauthErrorDescription =
    searchParams.get("error_description");

  const nextPath = "/dir/create";

  try {
    // ------------------------------------------------------------
    // 1. Handle Instagram OAuth errors
    // ------------------------------------------------------------

    if (oauthError) {
      throw new Error(
        oauthErrorDescription ||
          oauthError ||
          "Instagram authorization was denied."
      );
    }

    if (!code) {
      throw new Error(
        "No Instagram OAuth authorization code received."
      );
    }

    // ------------------------------------------------------------
    // 2. Verify OmniPost user session
    // ------------------------------------------------------------

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(
        "OmniPost user session not found."
      );
    }

    // ------------------------------------------------------------
    // 3. Verify OAuth state
    // ------------------------------------------------------------

    const cookieHeader =
      request.headers.get("cookie") || "";

    const cookieState = cookieHeader
      .match(
        /(?:^|;\s*)instagram_oauth_state=([^;]*)/
      )?.[1];

    if (
      !state ||
      !cookieState ||
      state !== cookieState
    ) {
      throw new Error(
        "Invalid OAuth state."
      );
    }

    // ------------------------------------------------------------
    // 4. Instagram App credentials
    // ------------------------------------------------------------

    const instagramAppId =
      process.env.INSTAGRAM_APP_ID;

    const instagramAppSecret =
      process.env.INSTAGRAM_APP_SECRET;

    if (
      !instagramAppId ||
      !instagramAppSecret
    ) {
      throw new Error(
        "INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET is missing."
      );
    }

    // ------------------------------------------------------------
    // 5. Exchange authorization code
    //    for a short-lived Instagram access token
    // ------------------------------------------------------------

    const tokenParams =
      new URLSearchParams({
        client_id: instagramAppId,
        client_secret: instagramAppSecret,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code,
      });

    const tokenResponse = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
      }
    );

    const tokenData =
      await tokenResponse.json();

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      console.error(
        "INSTAGRAM_TOKEN_ERROR:",
        tokenData
      );

      throw new Error(
        tokenData?.error_message ||
          tokenData?.error_type ||
          "Unable to exchange Instagram authorization code for access token."
      );
    }

    const shortLivedToken =
      tokenData.access_token;

    const instagramUserId =
      String(tokenData.user_id);

    // ------------------------------------------------------------
    // 6. Exchange short-lived token
    //    for long-lived Instagram token
    // ------------------------------------------------------------

    const longLivedParams =
      new URLSearchParams({
        grant_type:
          "ig_exchange_token",
        client_secret:
          instagramAppSecret,
        access_token:
          shortLivedToken,
      });

    const longLivedResponse =
      await fetch(
        `https://graph.instagram.com/access_token?${longLivedParams.toString()}`,
        {
          method: "GET",
        }
      );

    const longLivedData =
      await longLivedResponse.json();

    if (
      !longLivedResponse.ok ||
      !longLivedData.access_token
    ) {
      console.error(
        "INSTAGRAM_LONG_LIVED_TOKEN_ERROR:",
        longLivedData
      );

      throw new Error(
        longLivedData?.error?.message ||
          "Unable to obtain long-lived Instagram access token."
      );
    }

    const accessToken =
      longLivedData.access_token;

    const expiresIn =
      Number(longLivedData.expires_in) ||
      60 * 24 * 60 * 60;

    const expiresAt = new Date(
      Date.now() +
        expiresIn * 1000
    ).toISOString();

    // ------------------------------------------------------------
    // 7. Get Instagram profile
    // ------------------------------------------------------------

    const profileParams =
      new URLSearchParams({
        fields:
          "id,username,name,profile_picture_url",
        access_token:
          accessToken,
      });

    const profileResponse =
      await fetch(
        `https://graph.instagram.com/${instagramUserId}?${profileParams.toString()}`,
        {
          method: "GET",
        }
      );

    const profileData =
      await profileResponse.json();

    if (!profileResponse.ok) {
      console.error(
        "INSTAGRAM_PROFILE_ERROR:",
        profileData
      );

      throw new Error(
        profileData?.error?.message ||
          "Unable to retrieve Instagram profile."
      );
    }

    // ------------------------------------------------------------
    // 8. Save Instagram connection
    // ------------------------------------------------------------

    const {
      error: upsertError,
    } = await supabase
      .from("social_accounts")
      .upsert(
        {
          user_id: user.id,

          platform: "instagram",

          provider: "instagram",

          access_token:
            accessToken,

          is_connected: true,

          expires_at:
            expiresAt,

          // This is now the Instagram
          // professional account ID.
          page_id:
            instagramUserId,

          username:
            profileData.username ||
            null,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "user_id,platform",
        }
      );

    if (upsertError) {
      console.error(
        "SUPABASE_UPSERT_ERROR:",
        upsertError
      );

      throw new Error(
        `Unable to save Instagram connection: ${upsertError.message}`
      );
    }

    // ------------------------------------------------------------
    // 9. Remove OAuth state cookie
    // ------------------------------------------------------------

    const response =
      NextResponse.redirect(
        `${origin}${nextPath}?instagram=connected`
      );

    response.cookies.delete(
      "instagram_oauth_state"
    );

    return response;

  } catch (error: any) {
    console.error(
      "INSTAGRAM_CALLBACK_ERROR:",
      error
    );

    const response =
      NextResponse.redirect(
        `${origin}/dashboard?error=${encodeURIComponent(
          error?.message ||
            "Instagram connection failed."
        )}`
      );

    response.cookies.delete(
      "instagram_oauth_state"
    );

    return response;
  }
}