import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] Incoming request: ${req.method} ${req.url}`);

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Validate Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error(`[${requestId}] Missing Authorization header`);
      throw new Error("No authorization header provided");
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      console.error(`[${requestId}] Auth Error:`, authError);
      throw new Error("Invalid user token or unauthorized");
    }
    console.log(`[${requestId}] Authenticated User: ${user.id}`);

    // 2. Parse Body
    const body = await req.json()
    const { message, link, mediaPath } = body
    console.log(`[${requestId}] Payload:`, { message: message?.slice(0, 20) + "...", hasLink: !!link, mediaPath });

    // 3. Fetch Social Account
    console.log(`[${requestId}] Fetching Instagram account for user...`);
    const { data: social, error: dbError } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('platform', 'instagram')
      .single()

    if (dbError) {
      console.error(`[${requestId}] Database Error:`, dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (!social) {
      console.error(`[${requestId}] No Instagram account found in 'social_accounts' for this user ID.`);
      throw new Error("FB_EDGE_ERROR: Facebook account not connected.");
    }
    console.log(`[${requestId}] Found Page ID: ${social.page_id}`);

    if (!link) throw new Error("Instagram requires an image or video link.");

    // STEP 1: Create Container
    console.log(`[${requestId}] Step 1: Creating IG Media Container...`);
    const containerUrl = `https://graph.facebook.com/v20.0/${social.page_id}/media?image_url=${encodeURIComponent(link)}&caption=${encodeURIComponent(message)}&access_token=${social.access_token}`;
    
    const containerRes = await fetch(containerUrl, { method: "POST" });
    const containerData = await containerRes.json();

    if (!containerRes.ok) {
      console.error(`[${requestId}] IG Container Creation Failed:`, JSON.stringify(containerData, null, 2));
      throw new Error(`IG Container Error: ${containerData.error?.message || 'Unknown error'}`);
    }
    console.log(`[${requestId}] Container Created ID: ${containerData.id}`);

    // STEP 2: Publish
    console.log(`[${requestId}] Step 2: Publishing Media...`);
    const publishUrl = `https://graph.facebook.com/v20.0/${social.page_id}/media_publish?creation_id=${containerData.id}&access_token=${social.access_token}`;
    
    const publishRes = await fetch(publishUrl, { method: "POST" });
    const publishData = await publishRes.json();

    if (!publishRes.ok) {
      console.error(`[${requestId}] IG Publish Failed:`, JSON.stringify(publishData, null, 2));
      throw new Error(`IG Publish Error: ${publishData.error?.message || 'Unknown error'}`);
    }
    console.log(`[${requestId}] Successfully published to Instagram! ID: ${publishData.id}`);

    // Cleanup
    if (mediaPath) {
      console.log(`[${requestId}] Cleaning up storage: ${mediaPath}`);
      const { error: storageError } = await supabaseClient.storage.from('post-media').remove([mediaPath]);
      if (storageError) console.warn(`[${requestId}] Storage cleanup failed:`, storageError);
    }

    return new Response(JSON.stringify({ ok: true, id: publishData.id }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error(`[${requestId}] FINAL ERROR:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: error.message.includes("unauthorized") ? 401 : 400 
    });
  }
})




