import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  console.log(`[DEBUG] Incoming request: ${req.method} ${req.url}`);

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("[DEBUG] Missing Authorization header");
      throw new Error("Missing Authorization header");
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      console.error("[DEBUG] Auth error:", authError?.message);
      throw new Error("Unauthorized");
    }
    console.log(`[DEBUG] Authenticated user: ${user.id}`);

    const body = await req.json();
    const { message, link, mediaPath } = body;
    console.log("[DEBUG] Request body:", { message, link, mediaPath });

    const { data: social, error: dbError } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .single()

    if (dbError || !social) {
      console.error("[DEBUG] Database error or missing account:", dbError?.message);
      throw new Error("Facebook account not linked in database.");
    }
    console.log(`[DEBUG] Found Facebook Page ID: ${social.page_id}`);

    // Logic: If there is a link (image), use /photos, otherwise use /feed
    const isImage = link && (link.includes('.jpg') || link.includes('.png') || link.includes('post-media'));
    const fbUrl = isImage 
      ? `https://graph.facebook.com/v20.0/${social.page_id}/photos` 
      : `https://graph.facebook.com/v20.0/${social.page_id}/feed`;

    console.log(`[DEBUG] Target FB Endpoint: ${fbUrl} (isImage: ${isImage})`);

    const fbPayload = {
      access_token: social.access_token,
      [isImage ? 'caption' : 'message']: message
    };
    if (link) fbPayload[isImage ? 'url' : 'link'] = link;

    console.log("[DEBUG] Sending payload to Facebook...");
    
    const fbRes = await fetch(fbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fbPayload),
    });

    const fbData = await fbRes.json();
    console.log("[DEBUG] Facebook Response Status:", fbRes.status);
    console.log("[DEBUG] Facebook Response Data:", JSON.stringify(fbData));

    if (!fbRes.ok) {
      throw new Error(fbData.error?.message || "Facebook rejected the post");
    }

    // Cleanup storage
    if (mediaPath) {
      console.log(`[DEBUG] Attempting to remove media from storage: ${mediaPath}`);
      const { error: storageError } = await supabaseClient.storage.from('post-media').remove([mediaPath]);
      if (storageError) {
        console.error("[DEBUG] Storage cleanup failed:", storageError.message);
      } else {
        console.log("[DEBUG] Storage cleanup successful");
      }
    }

    return new Response(JSON.stringify({ ok: true, fb_id: fbData.id || fbData.post_id }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error("[DEBUG] Function execution failed:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    });
  }
})



