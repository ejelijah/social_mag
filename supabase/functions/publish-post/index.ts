import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to refresh tokens
async function refreshPlatformTokens(supabase: any, user_id: string, refreshToken: string) {
  console.log("Refreshing tokens with platform...")
  
  const clientId = Deno.env.get('TWITTER_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('TWITTER_CLIENT_SECRET') ?? ''

  // Twitter requires Client ID and Client Secret to be base64 encoded in the Authorization header
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
  if (!response.ok) throw new Error(`Refresh failed: ${JSON.stringify(tokens)}`)

  // Update DB with new tokens - Keeping your variable 'userId'
  const { error: updateError } = await supabase
    .from('social_accounts')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq('user_id', user_id)

  if (updateError) throw new Error("Failed to save new tokens to database")
  
  return tokens.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { content } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    // 1. Auth Check
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    if (!user) throw new Error("Unauthorized access")

    // 2. Get stored tokens - Keeping your variable 'user_id'
    const { data: integration } = await supabase.from('social_accounts').select('*').eq('user_id', user.id).single()
    if (!integration) throw new Error("No platform linked")

    let accessToken = integration.access_token
    const expiresAt = new Date(integration.expires_at).getTime()

    // 3. Initial Expiry Check (Safety Net 1)
    if (Date.now() > (expiresAt - 300000)) {
      accessToken = await refreshPlatformTokens(supabase, user.id, integration.refresh_token)
    }

    // 4. Attempt the Post
    console.log("Attempting post...")
    let postResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
    })

    // 5. THE ULTIMATE SAFETY NET: Retry on 401
    if (postResponse.status === 401) {
      console.warn("Post failed with 401. Forcing refresh and retrying...")
      
      // Force a refresh even if the database thought the token was valid
      const newAccessToken = await refreshPlatformTokens(supabase, user.id, integration.refresh_token)
      
      // Try the post one last time with the brand new token
      postResponse = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${newAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content }),
      })
    }

    const postResult = await postResponse.json()
    if (!postResponse.ok) throw new Error(`Platform Error: ${JSON.stringify(postResult)}`)

    console.log("Post successful!")
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error("Fatal Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})








