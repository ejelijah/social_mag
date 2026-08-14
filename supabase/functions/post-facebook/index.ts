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
    const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    const { message, link, mediaPath } = await req.json()

    const { data: social } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .single()

    if (!social) throw new Error("Facebook account not linked in database.");

    // Logic: If there is a link (image), use /photos, otherwise use /feed
    const isImage = link && (link.includes('.jpg') || link.includes('.png') || link.includes('post-media'));
    const fbUrl = isImage 
      ? `https://graph.facebook.com/v20.0/${social.page_id}/photos` 
      : `https://graph.facebook.com/v20.0/${social.page_id}/feed`;

    const fbPayload: any = {
      access_token: social.access_token,
      [isImage ? 'caption' : 'message']: message
    };
    if (link) fbPayload[isImage ? 'url' : 'link'] = link;

    const fbRes = await fetch(fbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fbPayload),
    });

    const fbData = await fbRes.json();
    if (!fbRes.ok) throw new Error(fbData.error?.message || "Facebook rejected the post");

    // Cleanup storage
    if (mediaPath) await supabaseClient.storage.from('post-media').remove([mediaPath]);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})



