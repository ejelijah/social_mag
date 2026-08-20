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

    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json()
    // mediaType should be 'IMAGE' or 'VIDEO'
    const { message, link, mediaType = 'IMAGE' } = body 

    const { data: social, error: dbError } = await supabaseClient
      .from('social_accounts')
      .select('access_token, page_id')
      .eq('user_id', user.id)
      .eq('platform', 'instagram')
      .single()

    if (dbError || !social) throw new Error("Instagram account not connected.");

    const token = social.access_token;
    const igId = social.page_id;

    // STEP 1: Create Media Container
    const containerPayload: any = {
      caption: message,
      access_token: token
    };

    if (mediaType === 'VIDEO') {
      containerPayload.media_type = 'VIDEO';
      containerPayload.video_url = link;
    } else {
      containerPayload.image_url = link;
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/v20.0/${igId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerPayload),
      }
    );
    
    const containerData = await containerRes.json();
    if (!containerRes.ok) throw new Error(`Container Error: ${containerData.error?.message}`);

    const containerId = containerData.id;

    // STEP 2: Wait for processing if it's a video
    // Videos must be processed by Instagram before they can be published.
    if (mediaType === 'VIDEO') {
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 30; // Check for up to 150 seconds

      while (status !== 'FINISHED' && attempts < maxAttempts) {
        // Wait 5 seconds between checks
        await new Promise(resolve => setTimeout(resolve, 5000)); 
        
        const statusRes = await fetch(
          `https://graph.facebook.com/v20.0/${containerId}?fields=status_code&access_token=${token}`
        );
        const statusData = await statusRes.json();
        status = statusData.status_code;
        
        if (status === 'ERROR') {
          throw new Error(`Video processing failed: ${statusData.error?.message || 'Unknown error'}`);
        }
        attempts++;
      }

      if (status !== 'FINISHED') {
        throw new Error("Video processing timed out. The file might be too large or the format is unsupported.");
      }
    }

    // STEP 3: Publish Media
    const publishRes = await fetch(
      `https://graph.facebook.com/v20.0/${igId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: token
        }),
      }
    );

    const publishData = await publishRes.json();
    if (!publishRes.ok) throw new Error(`Publish Error: ${publishData.error?.message}`);

    return new Response(JSON.stringify({ ok: true, id: publishData.id }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    });
  }
})