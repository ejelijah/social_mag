// app/api/oauth/instagram/callback/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const GRAPH_VERSION = "v20.0";

const REDIRECT_URI =
  "https://omnipost.one/api/oauth/instagram/callback";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  const nextPath = "/dir/create";

  try {
    // ------------------------------------------------------------
    // 1. Handle Meta OAuth errors
    // ------------------------------------------------------------

    if (oauthError) {
      throw new Error(
        oauthErrorDescription ||
          oauthError ||
          "Instagram authorization was denied."
      );
    }

    if (!code) {
      throw new Error("No OAuth authorization code received.");
    }

    // ------------------------------------------------------------
    // 2. Verify OAuth state
    // ------------------------------------------------------------

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User session not found.");
    }

    /*
     * Verify the state cookie.
     */
    const cookieState = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)instagram_oauth_state=([^;]*)/)?.[1];

    if (!state || !cookieState || state !== cookieState) {
      throw new Error("Invalid OAuth state.");
    }

    // ------------------------------------------------------------
    // 3. Exchange Meta authorization code for access token
    // ------------------------------------------------------------

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error(
        "INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET is missing."
      );
    }

    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: REDIRECT_URI,
      code,
    });

    const tokenResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("META_TOKEN_ERROR:", tokenData);

      throw new Error(
        tokenData?.error?.message ||
          "Unable to exchange authorization code for access token."
      );
    }

    const userAccessToken = tokenData.access_token;

    // ------------------------------------------------------------
    // 4. Get the Facebook Pages belonging to this Meta user
    // ------------------------------------------------------------

    const pagesUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`
    );

    pagesUrl.searchParams.set(
      "fields",
      "id,name,access_token,instagram_business_account"
    );

    pagesUrl.searchParams.set(
      "access_token",
      userAccessToken
    );

    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok) {
      console.error("META_PAGES_ERROR:", pagesData);

      throw new Error(
        pagesData?.error?.message ||
          "Unable to retrieve Facebook Pages."
      );
    }

    // ------------------------------------------------------------
    // 5. Find a Page connected to an Instagram Business account
    // ------------------------------------------------------------

    const targetPage = pagesData.data?.find(
      (page: any) => page.instagram_business_account?.id
    );

    if (!targetPage) {
      throw new Error(
        "No Instagram Business account connected to your Facebook Pages was found."
      );
    }

    const instagramBusinessAccountId =
      targetPage.instagram_business_account.id;

    // ------------------------------------------------------------
    // 6. Get Instagram account information
    // ------------------------------------------------------------

    const instagramUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/${instagramBusinessAccountId}`
    );

    instagramUrl.searchParams.set(
      "fields",
      "id,username,name,profile_picture_url"
    );

    /*
     * For Instagram Business publishing through the Page connection,
     * use the Page access token returned by /me/accounts.
     */
    instagramUrl.searchParams.set(
      "access_token",
      targetPage.access_token
    );

    const instagramResponse = await fetch(
      instagramUrl.toString()
    );

    const instagramData = await instagramResponse.json();

    if (!instagramResponse.ok) {
      console.error(
        "INSTAGRAM_ACCOUNT_ERROR:",
        instagramData
      );

      throw new Error(
        instagramData?.error?.message ||
          "Unable to retrieve Instagram Business account."
      );
    }

    // ------------------------------------------------------------
    // 7. Save the connection to Supabase
    // ------------------------------------------------------------

    const expiresIn =
      tokenData.expires_in || 60 * 24 * 60 * 60;

    const expiresAt = new Date(
      Date.now() + expiresIn * 1000
    ).toISOString();

    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert(
        {
          user_id: user.id,
          platform: "instagram",
          provider: "facebook",
          access_token: targetPage.access_token,
          is_connected: true,
          expires_at: expiresAt,
          page_id: instagramBusinessAccountId,
          username:
            instagramData.username ||
            targetPage.name ||
            null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,platform",
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
    // 8. Remove OAuth state cookie and return to OmniPost
    // ------------------------------------------------------------

    const response = NextResponse.redirect(
      `${origin}${nextPath}?instagram=connected`
    );

    response.cookies.delete("instagram_oauth_state");

    return response;
  } catch (error: any) {
    console.error("INSTAGRAM_CALLBACK_ERROR:", error);

    const response = NextResponse.redirect(
      `${origin}/dashboard?error=${encodeURIComponent(
        error?.message ||
          "Instagram connection failed."
      )}`
    );

    response.cookies.delete("instagram_oauth_state");

    return response;
  }
}
