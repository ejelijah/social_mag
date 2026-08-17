import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Initialize userId as anonymous in case auth fails early
  let userId = 'anonymous';

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("[DEBUG] [User: anonymous] Missing Authorization header");
      throw new Error("Missing Authorization header");
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (authError || !user) {
      console.error("[DEBUG] [User: anonymous] Auth error:", authError?.message);
      throw new Error("Unauthorized");
    }

    // Set the userId for all subsequent logs
    userId = user.id;
    console.log(`[DEBUG] [User: ${userId}] Authenticated successfully`);

    const body = await req.json();
    const { message, link, mediaPath } = body;

    const { data: social, error: dbError } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .single()

    if (dbError || !social) {
      console.error(`[DEBUG] [User: ${userId}] Database error or missing account:`, dbError?.message);
      throw new Error("Facebook account not linked in database.");
    }

    const isImage = link && (link.includes('.jpg') || link.includes('.png') || link.includes('post-media'));
    const fbUrl = isImage 
      ? `https://graph.facebook.com/v20.0/${social.page_id}/photos` 
      : `https://graph.facebook.com/v20.0/${social.page_id}/feed`;

    const fbPayload = {
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

    if (!fbRes.ok) {
      // Include User ID in the Facebook rejection log
      console.error(`[DEBUG] [User: ${userId}] Facebook API Error:`, JSON.stringify(fbData));
      throw new Error(fbData.error?.message || "Facebook rejected the post");
    }

    if (mediaPath) {
      const { error: storageError } = await supabaseClient.storage.from('post-media').remove([mediaPath]);
      if (storageError) {
        console.error(`[DEBUG] [User: ${userId}] Storage cleanup failed:`, storageError.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, fb_id: fbData.id || fbData.post_id }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    // This main error log will now always show the User ID if they were authenticated
    console.error(`[DEBUG] [User: ${userId}] Function execution failed:`, error.message);
    
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    });
  }
})




