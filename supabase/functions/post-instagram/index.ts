import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH_VERSION = "v22.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // ------------------------------------------------------------
  // CORS
  // ------------------------------------------------------------
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // ------------------------------------------------------------
    // 1. Read request
    // ------------------------------------------------------------
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
    // 2. Supabase
    // ------------------------------------------------------------
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ------------------------------------------------------------
    // 3. Get Instagram account
    // ------------------------------------------------------------
    const {
      data: account,
      error: accountError,
    } = await supabase
      .from("social_accounts")
      .select(
        "access_token, page_id, username"
      )
      .eq("user_id", user_id)
      .eq("platform", "instagram")
      .single();

    if (accountError || !account) {
      throw new Error(
        `Instagram account not found for user: ${user_id}`
      );
    }

    if (!account.access_token) {
      throw new Error(
        "Instagram access token is missing."
      );
    }

    if (!account.page_id) {
      throw new Error(
        "Instagram page ID is missing."
      );
    }

    // ------------------------------------------------------------
    // 4. Clean credentials
    // ------------------------------------------------------------
    const accessToken =
      account.access_token
        .trim()
        .replace(/^["']|["']$/g, "");

    const instagramUserId =
      String(account.page_id).trim().replace(/^["']|["']$/g, "");

    console.log("Instagram publishing request:", {
      user_id,
      page_id: instagramUserId,
      username: account.username,
      image_url,
    });

    // ------------------------------------------------------------
    // 5. Create media container
    //
    // Instagram Login API:
    //
    // POST
    // https://graph.instagram.com/{version}/{ig-user-id}/media
    // ------------------------------------------------------------

    const createUrl =
      `https://graph.instagram.com/${GRAPH_VERSION}/${instagramUserId}/media`;

    const createParams =
      new URLSearchParams({
        image_url,
        caption,
      });

    const createResponse = await fetch(
      createUrl,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body: createParams.toString(),
      }
    );

    const createText =
      await createResponse.text();

    let createData: any;

    try {
      createData =
        JSON.parse(createText);
    } catch {
      throw new Error(
        `Instagram returned non-JSON response: ${createText}`
      );
    }

    console.log(
      "Instagram container response:",
      createData
    );

    if (!createResponse.ok) {
      throw new Error(
        createData?.error?.message ||
          `Container creation failed (${createResponse.status})`
      );
    }

    const creationId =
      createData.id;

    if (!creationId) {
      throw new Error(
        "Instagram did not return a creation ID."
      );
    }

    // ------------------------------------------------------------
    // 6. Wait for container processing
    //
    // Don't assume 3 seconds is enough.
    // ------------------------------------------------------------

    let containerStatus = "IN_PROGRESS";

    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) =>
        setTimeout(resolve, 3000)
      );

      const statusUrl =
        `https://graph.instagram.com/${GRAPH_VERSION}/${creationId}`;

      const statusParams =
        new URLSearchParams({
          fields: "status_code,status",
        });

      const statusResponse =
        await fetch(
          `${statusUrl}?${statusParams.toString()}`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

      const statusText =
        await statusResponse.text();

      let statusData: any;

      try {
        statusData =
          JSON.parse(statusText);
      } catch {
        throw new Error(
          `Instagram status check returned non-JSON: ${statusText}`
        );
      }

      console.log(
        "Instagram container status:",
        statusData
      );

      if (!statusResponse.ok) {
        throw new Error(
          statusData?.error?.message ||
            `Unable to check container status (${statusResponse.status})`
        );
      }

      containerStatus =
        statusData.status_code;

      if (
        containerStatus ===
        "FINISHED"
      ) {
        break;
      }

      if (
        containerStatus ===
          "ERROR" ||
        containerStatus ===
          "EXPIRED"
      ) {
        throw new Error(
          statusData.status ||
            `Instagram container failed with status: ${containerStatus}`
        );
      }
    }

    if (
      containerStatus !==
      "FINISHED"
    ) {
      throw new Error(
        `Instagram media container was not ready. Final status: ${containerStatus}`
      );
    }

    // ------------------------------------------------------------
    // 7. Publish container
    //
    // POST
    // https://graph.instagram.com/{version}/{ig-user-id}/media_publish
    // ------------------------------------------------------------

    const publishUrl =
      `https://graph.instagram.com/${GRAPH_VERSION}/${instagramUserId}/media_publish`;

    const publishParams =
      new URLSearchParams({
        creation_id: creationId,
      });

    const publishResponse =
      await fetch(
        publishUrl,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            publishParams.toString(),
        }
      );

    const publishText =
      await publishResponse.text();

    let publishData: any;

    try {
      publishData =
        JSON.parse(publishText);
    } catch {
      throw new Error(
        `Instagram publish returned non-JSON response: ${publishText}`
      );
    }

    console.log(
      "Instagram publish response:",
      publishData
    );

    if (!publishResponse.ok) {
      throw new Error(
        publishData?.error?.message ||
          `Instagram publishing failed (${publishResponse.status})`
      );
    }

    if (!publishData.id) {
      throw new Error(
        "Instagram did not return a published media ID."
      );
    }

    // ------------------------------------------------------------
    // 8. Success
    // ------------------------------------------------------------

    return new Response(
      JSON.stringify({
        success: true,
        media_id: publishData.id,
        creation_id: creationId,
        page_id: instagramUserId,
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
      "INSTAGRAM_PUBLISH_ERROR:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error?.message ||
          "Instagram publishing failed.",
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