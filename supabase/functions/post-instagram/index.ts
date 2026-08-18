import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const requestId = crypto.randomUUID().slice(0, 8);
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')
    
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json()
    const { message, link, mediaPath } = body

    const { data: social, error: dbError } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('platform', 'instagram')
      .single()

    if (dbError || !social) throw new Error("Instagram account not connected.");

    // 1. CLEAN THE TOKEN
    const token = social.access_token?.trim();
    
    // 2. DEBUG LOG (Temporary - remove after fixing)
    // This logs the first 20 and last 20 characters to see if it's being cut off
    console.log(`[${requestId}] DEBUG: Full Token Stats - Length: ${token?.length}`);
    console.log(`[${requestId}] DEBUG: Token Start: "${token?.substring(0, 20)}..."`);
    console.log(`[${requestId}] DEBUG: Token End: "...${token?.substring(token.length - 20)}"`);

    // 3. SWITCH TO POST BODY (More reliable than URL params)
    console.log(`[${requestId}] Step 1: Creating IG Media Container...`);
    
    const fbPayload = {
      image_url: link,
      caption: message,
      access_token: token // Sending in body instead of URL
    };

    const containerRes = await fetch(`https://graph.facebook.com/v20.0/${social.page_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fbPayload),
    });

    const containerData = await containerRes.json();

    if (!containerRes.ok) {
      // If this fails, we log exactly what we sent (minus the token for safety)
      console.error(`[${requestId}] IG Container Error Details:`, {
        status: containerRes.status,
        sentToPageId: social.page_id,
        payloadSent: { ...fbPayload, access_token: "REDACTED" },
        response: containerData
      });
      throw new Error(`IG Container Error: ${containerData.error?.message}`);
    }

    // STEP 2: Publish
    const publishRes = await fetch(`https://graph.facebook.com/v20.0/${social.page_id}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: token
      }),
    });

    const publishData = await publishRes.json();

    if (!publishRes.ok) {
      throw new Error(`IG Publish Error: ${publishData.error?.message}`);
    }

    if (mediaPath) {
      await supabaseClient.storage.from('post-media').remove([mediaPath]);
    }

    return new Response(JSON.stringify({ ok: true, id: publishData.id }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error(`[${requestId}] 🛑 FINAL ERROR:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    });
  }
})
