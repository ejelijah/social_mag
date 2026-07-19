import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Initialize Supabase Client with Service Role (to bypass RLS for lookup)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Get User ID from the Auth Header (passed automatically by Supabase client)
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) throw new Error("Unauthorized")

    // 3. Parse request body
    const { message, link } = await req.json()

    // 4. Fetch the Facebook credentials from the database
    const { data: social, error: dbError } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('provider', 'facebook')
      .single()

    if (dbError || !social) throw new Error("Facebook account not connected.")

    // 5. Post to Facebook
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

    return new Response(JSON.stringify({ ok: fbResponse.ok, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: fbResponse.status,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})


