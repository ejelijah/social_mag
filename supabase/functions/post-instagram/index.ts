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
      .eq('platform', 'instagram')
      .single()

    if (dbError || !social) throw new Error("Instagram account not connected in database.")

    // Step 1: Create Media Container
    // The ID below MUST be the Instagram Business Account ID
    const containerUrl = `https://graph.facebook.com/v20.0/${social.page_id}/media`;
    const containerRes = await fetch(containerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: link,
        caption: message,
        access_token: social.access_token
      })
    })

    const containerData = await containerRes.json()
    
    if (!containerRes.ok) {
      // This is where "Invalid Credentials" comes from
      if (containerData.error?.code === 190) {
        throw new Error("Instagram session expired. Please reconnect your account.");
      }
      throw new Error(`Meta Error: ${containerData.error?.message || "Container failed"}`);
    }

    // Step 2: Publish Container
    const publishRes = await fetch(
      `https://graph.facebook.com/v20.0/${social.page_id}/media_publish?creation_id=${containerData.id}&access_token=${social.access_token}`,
      { method: "POST" }
    )
    const publishData = await publishRes.json()
    if (!publishRes.ok) throw new Error(publishData.error?.message || "Publish failed");

    // 3. Cleanup: Delete from Storage
    if (mediaPath) {
      await supabaseClient.storage.from('post-media').remove([mediaPath]);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("IG_PUBLISH_ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})


