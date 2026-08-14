import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    const { message, link, mediaPath } = await req.json()

    const { data: social } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('platform', 'instagram')
      .single()

    if (!social) throw new Error("Instagram not connected.");
    if (!link) throw new Error("Instagram requires an image or video link.");

    // STEP 1: Create Container
    const containerRes = await fetch(
      `https://graph.facebook.com/v20.0/${social.page_id}/media?image_url=${encodeURIComponent(link)}&caption=${encodeURIComponent(message)}&access_token=${social.access_token}`,
      { method: "POST" }
    );
    const containerData = await containerRes.json();
    if (!containerRes.ok) throw new Error(`IG Container Error: ${containerData.error?.message}`);

    // STEP 2: Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v20.0/${social.page_id}/media_publish?creation_id=${containerData.id}&access_token=${social.access_token}`,
      { method: "POST" }
    );
    const publishData = await publishRes.json();
    if (!publishRes.ok) throw new Error(`IG Publish Error: ${publishData.error?.message}`);

    // Cleanup
    if (mediaPath) await supabaseClient.storage.from('post-media').remove([mediaPath]);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})



