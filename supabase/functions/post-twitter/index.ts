import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshTwitterTokens(supabase: any, user_id: string, refreshToken: string) {
  const clientId = Deno.env.get('TWITTER_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('TWITTER_CLIENT_SECRET') ?? ''
  const credentials = btoa(`${clientId}:${clientSecret}`)

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}` 
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await response.json()
  if (!response.ok) throw new Error(`Twitter refresh failed: ${JSON.stringify(tokens)}`)

  await supabase.from('social_accounts').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq('user_id', user_id).eq('platform', 'twitter')

  return tokens.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { content } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    if (!user) throw new Error("Unauthorized")

    const { data: acc } = await supabase.from('social_accounts').select('*').eq('user_id', user.id).eq('platform', 'twitter').single()
    if (!acc) throw new Error("Twitter account not linked")

    let token = acc.access_token
    if (new Date(acc.expires_at).getTime() < Date.now() + 300000) {
      token = await refreshTwitterTokens(supabase, user.id, acc.refresh_token)
    }

    const postResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
    })

    const result = await postResponse.json()
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  }
})

