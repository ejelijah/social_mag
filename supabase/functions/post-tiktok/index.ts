import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Helper to safely parse TikTok V2 API responses.
 * TikTok V2 returns successful data in a 'data' property and errors in an 'error' property.
 */
async function handleResponse(response, context) {
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`${context} failed (${response.status}). Server returned HTML/Text instead of JSON.`);
  }
  let p;

  // TikTok V2 Specific Error Handling
  if (!response.ok || json.error) {
    const message = json.error?.message || json.error_description || "Unknown TikTok API Error";
    throw new Error(`${context} Error: ${message} (Status: ${response.status})`);
  }

  return json;
}

/**
 * Refreshes the TikTok Access Token and updates the Supabase database.
 */
async function refreshTikTokTokens(supabase, user_id, refreshToken) {
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
  console.log("Client Key length:", clientKey?.length);
  console.log("Client Secret length:", clientSecret?.length);
  console.log("First 3 chars of Key:", clientKey?.substring(0, 3));

  if (!clientKey || !clientSecret) {
    throw new Error("Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET in environment variables.");
  }

  const url = "https://open.tiktokapis.com/v2/oauth/token/";

  const response = await fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache"
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  const result = await handleResponse(response, "TikTok Token Refresh");
  const tokens = result.data; // TikTok V2 nesting

  if (!tokens?.access_token) {
    throw new Error("TikTok refresh successful but no access_token was returned in the data object.");
  }

  // Update the social_accounts table with new tokens
  const { error: updateError } = await supabase
    .from('social_accounts')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken, // Use old one if new one isn't provided
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user_id)
    .eq('platform', 'tiktok');

  if (updateError) {
    throw new Error(`Failed to update Supabase with refreshed tokens: ${updateError.message}`);
  }

  return tokens.access_token;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse and validate payload
    const payload = await req.json();
    const { video_url, title, user_id } = payload;

    if (!video_url || !user_id) {
      throw new Error("Missing required fields: video_url and user_id are mandatory.");
    }

    // 1. Fetch account details from Supabase
    const { data: acc, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user_id)
      .eq('platform', 'tiktok')
      .single();

    if (dbError || !acc) {
      console.error("DB Fetch Error:", dbError);
      throw new Error("TikTok account not linked or not found for this user.");
    }

    // 2. Check if token needs refresh (5-minute buffer)
    let token = acc.access_token;
    const isExpired = new Date(acc.expires_at).getTime() < Date.now() + 300000;

    if (isExpired) {
      console.log("Token expired or expiring soon. Refreshing...");
      token = await refreshTikTokTokens(supabase, user_id, acc.refresh_token);
    }

    // 3. Initialize Video Post on TikTok
    const safeTitle = title?.substring(0, 150) || "New Video";
    const publishUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";

    const response = await fetch(publishUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        source: "PULL_FROM_URL",
        video_url: video_url,
        post_info: {
          title: safeTitle,
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        },
      }),
    });

    const result = await handleResponse(response, "TikTok Video Init");

    // TikTok V2 returns the publish_id inside the data object
    return new Response(
      JSON.stringify({ 
        success: true, 
        publish_id: result.data?.publish_id,
        message: "Video initialization successful." 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Worker Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})


