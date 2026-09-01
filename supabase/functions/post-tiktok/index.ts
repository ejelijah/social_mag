import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to safely parse JSON or return the raw text on error
async function handleResponse(response, context) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    // If parsing fails, it's likely an HTML error page. 
    // We throw a descriptive error including the status code.
    throw new Error(`${context} failed (${response.status}). The server returned HTML instead of JSON. Check your API scopes or URL.`);
  }
}

async function refreshTikTokTokens(supabase, user_id, refreshToken) {
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");

  // Check if env vars are missing
  if (!clientKey || !clientSecret) {
    throw new Error("Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET in Supabase secrets.");
  }

  // Removed the trailing slash from the URL
  const url = "https://open.tiktokapis.com/v2/auth/token/refresh";

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
    }),
  });

  const tokens = await handleResponse(response, "TikTok Token Refresh");

  if (!response.ok) {
    throw new Error(`TikTok refresh failed: ${tokens.error_description || tokens.error_message || 'Unknown Error'}`);
  }

  // Update Supabase with new tokens
  const { error: updateError } = await supabase.from('social_accounts').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', user_id).eq('platform', 'tiktok');

  if (updateError) throw new Error(`Failed to update Supabase: ${updateError.message}`);

  return tokens.access_token;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const bodyText = await req.text();
    if (!bodyText) throw new Error("Request body is empty");
    
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      throw new Error("Invalid JSON in request body");
    }
    
    const { video_url, title, user_id } = payload;

    const { data: acc, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user_id)
      .eq('platform', 'tiktok')
      .single();

    if (!acc || dbError) throw new Error("TikTok account not linked in Supabase");

    let token = acc.access_token;
    if (new Date(acc.expires_at).getTime() < Date.now() + 300000) {
      token = await refreshTikTokTokens(supabase, user_id, acc.refresh_token);
    }

    const safeTitle = title?.substring(0, 150) || "New Video";

    const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
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

    if (!response.ok || result.error) {
      throw new Error(`TikTok API Error: ${result.error?.message || 'Failed to initialize post'}`);
    }

    return new Response(
      JSON.stringify({ success: true, publish_id: result.data?.publish_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("TikTok Function Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})


