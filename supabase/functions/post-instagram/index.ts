// supabase/functions/instagram-post/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH_VERSION = "v20.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    const {
      user_id,
      image_url,
      caption = "",
    } = body;

    if (!user_id) {
      throw new Error("user_id is required.");
    }

    if (!image_url) {
      throw new Error("image_url is required.");
    }

    // ------------------------------------------------------------
    // Supabase client
    // ------------------------------------------------------------

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Supabase environment variables are missing."
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // ------------------------------------------------------------
    // Get connected Instagram account
    // ------------------------------------------------------------

    const { data: account, error: accountError } =
      await supabase
        .from("social_accounts")
        .select(
          "access_token,page_id,username,is_connected,expires_at"
        )
        .eq("user_id", user_id)
        .eq("platform", "instagram")
        .eq("is_connected", true)
        .single();

    if (accountError || !account) {
      throw new Error(
        "No connected Instagram account was found."
      );
    }

    const accessToken = account.access_token;
    const instagramBusinessId = account.page_id;

    if (!accessToken) {
      throw new Error(
        "Instagram access token is missing."
      );
    }

    if (!instagramBusinessId) {
      throw new Error(
        "Instagram Business Account ID is missing."
      );
    }

    // ------------------------------------------------------------
    // 1. Create Instagram media container
    // ------------------------------------------------------------

    const createParams = new URLSearchParams();

    createParams.set(
      "image_url",
      image_url
    );

    createParams.set(
      "caption",
      caption
    );

    createParams.set(
      "access_token",
      accessToken
    );

    const createResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${instagramBusinessId}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: createParams.toString(),
      }
    );

    const createData =
      await createResponse.json();

    if (!createResponse.ok || !createData.id) {
      console.error(
        "INSTAGRAM_MEDIA_CREATE_ERROR:",
        createData
      );

      throw new Error(
        createData?.error?.message ||
          "Instagram media container creation failed."
      );
    }

    const creationId = createData.id;

    // ------------------------------------------------------------
    // 2. Wait briefly for Instagram to process media
    // ------------------------------------------------------------

    await new Promise((resolve) =>
      setTimeout(resolve, 3000)
    );

    // ------------------------------------------------------------
    // 3. Check container status
    // ------------------------------------------------------------

    const statusUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/${creationId}`
    );

    statusUrl.searchParams.set(
      "fields",
      "status_code,status"
    );

    statusUrl.searchParams.set(
      "access_token",
      accessToken
    );

    const statusResponse = await fetch(
      statusUrl.toString()
    );

    const statusData =
      await statusResponse.json();

    if (!statusResponse.ok) {
      console.error(
        "INSTAGRAM_STATUS_ERROR:",
        statusData
      );

      throw new Error(
        statusData?.error?.message ||
          "Unable to check Instagram media status."
      );
    }

    if (
      statusData.status_code &&
      statusData.status_code !== "FINISHED"
    ) {
      throw new Error(
        `Instagram media is not ready yet. Status: ${statusData.status_code}`
      );
    }

    // ------------------------------------------------------------
    // 4. Publish the media container
    // ------------------------------------------------------------

    const publishParams =
      new URLSearchParams();

    publishParams.set(
      "creation_id",
      creationId
    );

    publishParams.set(
      "access_token",
      accessToken
    );

    const publishResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${instagramBusinessId}/media_publish`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: publishParams.toString(),
      }
    );

    const publishData =
      await publishResponse.json();

    if (
      !publishResponse.ok ||
      !publishData.id
    ) {
      console.error(
        "INSTAGRAM_PUBLISH_ERROR:",
        publishData
      );

      throw new Error(
        publishData?.error?.message ||
          "Instagram publishing failed."
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        instagram_account_id:
          instagramBusinessId,
        username:
          account.username,
        creation_id: creationId,
        media_id: publishData.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "INSTAGRAM_POST_ERROR:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error?.message ||
          "Instagram posting failed.",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});