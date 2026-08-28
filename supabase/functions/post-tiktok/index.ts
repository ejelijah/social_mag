import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to refresh TikTok tokens if expired
async function refreshTikTokTokens(supabase, user_id, refreshToken) {
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");

  const response = await fetch("https://open.tiktokapis.com/v2/auth/token/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const text = await response.text();
  const tokens = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`TikTok refresh failed: ${tokens.error_description || tokens.error_message || 'Unknown Error'}`);
  }

  // Update Supabase with new tokens
  await supabase.from('social_accounts').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', user_id).eq('platform', 'tiktok');

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
    const { video_url, title, user_id } = JSON.parse(bodyText);

    // 1. Fetch TikTok credentials from Supabase
    const { data: acc, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user_id)
      .eq('platform', 'tiktok')
      .single();

    if (!acc || dbError) throw new Error("TikTok account not linked in Supabase");

    // 2. Check if token needs refreshing (within 5 mins of expiry)
    let token = acc.access_token;
    if (new Date(acc.expires_at).getTime() < Date.now() + 300000) {
      token = await refreshTikTokTokens(supabase, user_id, acc.refresh_token);
    }

    const safeTitle = title?.substring(0, 150) || "New Video";

    // 3. TikTok Content Posting API
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

    const responseText = await response.text();
    const result = responseText ? JSON.parse(responseText) : {};

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


