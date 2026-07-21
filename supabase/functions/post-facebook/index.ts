import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Helper to verify if the Facebook token is still valid
 */
async function isFacebookTokenValid(accessToken: string) {
  try {
    const response = await fetch(`https://graph.facebook.com/me?access_token=${accessToken}`);
    return response.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) throw new Error("Unauthorized")

    const { message, link } = await req.json()

    // 1. Fetch credentials
    const { data: social, error: dbError } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('provider', 'facebook')
      .single()

    if (dbError || !social) throw new Error("Facebook account not connected.")

    // 2. THE SAFE CHECK: Verify token validity
    console.log("DEBUG: Verifying Facebook Token...");
    const isValid = await isFacebookTokenValid(social.access_token);
    
    if (!isValid) {
      // If invalid, we update the DB to show it's disconnected
      await supabaseClient
        .from('social_accounts')
        .update({ is_connected: false })
        .match({ user_id: user.id, provider: 'facebook' });
        
      throw new Error("Facebook session expired. Please reconnect your account.");
    }

    // 3. Post to Facebook
    const fbUrl = `https://graph.facebook.com/v20.0/${social.page_id}/feed`
    const fbResponse = await fetch(fbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        link,
        access_token: social.access_token,
      }),
    })

    const result = await fbResponse.json()

    if (!fbResponse.ok) {
      // If the post fails specifically because of a token error (Error code 190)
      if (result.error?.code === 190) {
        throw new Error("Facebook authentication failed. Please reconnect your account.");
      }
      throw new Error(result.error?.message || "Facebook posting failed.");
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("FB_EDGE_ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

