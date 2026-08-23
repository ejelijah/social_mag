// 1. Ensure you are using raw characters, not HTML entities
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH_VERSION = "v20.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, image_url, caption = "" } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: account, error: accountError } = await supabase
      .from("social_accounts")
      .select("access_token, page_id")
      .eq("user_id", user_id)
      .eq("platform", "instagram")
      .single();

    if (accountError || !account) throw new Error("Account not found");

    // FIX: Trim the token and remove any accidental literal quotes
    const accessToken = account.access_token.trim().replace(/^["']|["']$/g, "");
    const instagramBusinessId = account.page_id;

    // ------------------------------------------------------------
    // 1. Create Media Container
    // ------------------------------------------------------------
    // Move access_token to the URL to avoid parsing issues in the body
    const createUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${instagramBusinessId}/media`;
    
    const createParams = new URLSearchParams({
      image_url: image_url,
      caption: caption,
      access_token: accessToken, // Passing here is safer
    });

    const createResponse = await fetch(`${createUrl}?${createParams.toString()}`, {
      method: "POST",
    });

    const createData = await createResponse.json();
    if (!createResponse.ok) {
      throw new Error(createData?.error?.message || "Container creation failed");
    }

    const creationId = createData.id;

    // ... (Wait for processing) ...
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // ------------------------------------------------------------
    // 2. Publish
    // ------------------------------------------------------------
    const publishUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${instagramBusinessId}/media_publish`;
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    });

    const publishResponse = await fetch(`${publishUrl}?${publishParams.toString()}`, {
      method: "POST",
    });

    const publishData = await publishResponse.json();
    
    return new Response(JSON.stringify({ success: true, media_id: publishData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
