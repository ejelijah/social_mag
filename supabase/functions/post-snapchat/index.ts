import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ... (keep your imports and corsHeaders the same)

async function refreshSnapchatTokens(supabase: any, user_id: string, refreshToken: string) {
  const response = await fetch("https://accounts.snapchat.com/login/oauth2/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: Deno.env.get("SNAPCHAT_CLIENT_ID")!,
      client_secret: Deno.env.get("SNAPCHAT_CLIENT_SECRET")!,
    }),
  });

  // Check if response is actually JSON before parsing
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const textError = await response.text();
    throw new Error(`Snapchat Refresh Error (Non-JSON): ${textError}`);
  }

  const tokens = await response.json();
  if (!response.ok) throw new Error(`Snapchat refresh failed: ${tokens.error_description || tokens.error}`);

  await supabase.from('social_accounts').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || refreshToken,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', user_id).eq('platform', 'snapchat');

  return tokens.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { message, link, user_id } = await req.json();

    const { data: acc } = await supabase.from('social_accounts').select('*').eq('user_id', user_id).eq('platform', 'snapchat').single();
    if (!acc) throw new Error("Snapchat account not linked");

    let token = acc.access_token;
    if (new Date(acc.expires_at).getTime() < Date.now() + 300000) {
      try {
        token = await refreshSnapchatTokens(supabase, user_id, acc.refresh_token);
      } catch (refreshErr) {
        throw new Error(`Token refresh failed. The user may need to re-login. Details: ${refreshErr.message}`);
      }
    }

    const snapResponse = await fetch("https://adsapi.snapchat.com/v1/me/spotlight", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "media_url": link,
        "caption": message,
        "scheduled_at": new Date().toISOString()
      })
    });

    // Handle non-JSON response from the post request as well
    if (!snapResponse.ok) {
      const errorText = await snapResponse.text();
      throw new Error(`Snapchat API rejected the post: ${errorText}`);
    }

    const snapResult = await snapResponse.json();
    return new Response(JSON.stringify({ success: true, data: snapResult }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("[Snapchat Error]", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})



