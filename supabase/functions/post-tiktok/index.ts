import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming TikTok Post Request`);

  try {
    const { video_url, title, access_token } = await req.json();

    // 1. Validation Logic
    if (!access_token) {
      console.error("DEBUG: Missing access_token");
      return new Response(JSON.stringify({ error: "Unauthorized: Missing access_token" }), { status: 401 });
    }

    if (!video_url) {
      console.error("DEBUG: Missing video_url");
      return new Response(JSON.stringify({ error: "Bad Request: Missing video_url" }), { status: 400 });
    }

    // 2. Improvement: Title Truncation (TikTok limit is usually around 150-200 chars)
    const safeTitle = title?.substring(0, 150) || "New Video";

    console.log(`DEBUG: Attempting TikTok PULL_FROM_URL for: ${video_url}`);
    console.log(`DEBUG: Using title: "${safeTitle}"`);

    // 3. TikTok Content Posting API (v2)
    const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        source: "PULL_FROM_URL",
        video_url: video_url,
        post_info: {
          title: safeTitle,
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        },
      }),
    });

    const result = await response.json();

    // 4. Enhanced Error Debugging
    if (!response.ok || result.error) {
      console.error("DEBUG: TikTok API Error Response:", JSON.stringify(result, null, 2));
      
      // TikTok uses custom error codes in their body even if status is 200
      return new Response(JSON.stringify({
        success: false,
        status: response.status,
        tiktok_error: result.error || "Unknown TikTok Error",
        message: result.error?.message || "Failed to initialize TikTok post"
      }), { 
        status: response.status === 200 ? 400 : response.status,
        headers: { "Content-Type": "application/json" } 
      });
    }

    console.log("DEBUG: TikTok Success! Publish ID:", result.data?.publish_id);

    return new Response(JSON.stringify({
      success: true,
      publish_id: result.data?.publish_id,
      details: result.data
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("DEBUG: Critical Edge Function Error:", err.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Internal Server Error", 
      message: err.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    });
  }
})

