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

    // The frontend sends "message" and "link"
    const { message, link } = await req.json()

    // 1. Fetch credentials
    // IMPORTANT: Ensure your DB uses 'facebook' in the provider column
    const { data: social, error: dbError } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('platform', 'facebook') // Changed 'provider' to 'platform' to match your DB
      .single()

    if (dbError || !social) throw new Error("Facebook account not connected in database.")
    if (!social.page_id || social.page_id.length < 5) throw new Error("Invalid Page ID. Please reconnect your Facebook Page.");

    // 2. Post to Facebook Page Feed
    const fbUrl = `https://graph.facebook.com/v20.0/${social.page_id}/feed`
    
    const body: any = {
      message: message || "",
      access_token: social.access_token,
    }
    
    // Only add link if it's a valid URL
    if (link && link.startsWith('http')) {
      body.link = link;
    }

    const fbResponse = await fetch(fbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const result = await fbResponse.json()

    if (!fbResponse.ok) {
      throw new Error(result.error?.message || "Facebook API rejected the post.");
    }

    return new Response(JSON.stringify({ ok: true, result }), {
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

