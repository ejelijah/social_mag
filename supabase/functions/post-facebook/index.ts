import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { message, link, mediaPath } = await req.json()

    // 1. Fetch Credentials
    const { data: social, error: dbError } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .single()

    if (dbError || !social) throw new Error("Facebook not connected.", { cause: dbError })

    // 2. Determine Endpoint (Photos vs Feed)
    let fbUrl = `https://graph.facebook.com/v20.0/${social.page_id}/feed`;
    let body: any = { access_token: social.access_token };

    if (link && link.includes('post-media')) {
      // If there's an image, use the photos endpoint
      fbUrl = `https://graph.facebook.com/v20.0/${social.page_id}/photos`;
      body.url = link;
      body.caption = message;
    } else {
      body.message = message;
    }

    const fbResponse = await fetch(fbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const result = await fbResponse.json()
    if (!fbResponse.ok) throw new Error(result.error?.message || "FB Post Failed");

    // 3. Cleanup: Delete from Storage
    if (mediaPath) {
      await supabaseClient.storage.from('post-media').remove([mediaPath]);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})


