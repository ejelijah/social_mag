import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const { title, description, video_url, access_token } = await req.json()

    // 1. Initiate Resumable Upload
    const initResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/*",
        },
        body: JSON.stringify({
          snippet: {
            title: title,
            description: description,
            categoryId: "22", // People & Blogs
          },
          status: {
            privacyStatus: "public",
          },
        }),
      }
    )

    const uploadUrl = initResponse.headers.get("Location")
    if (!uploadUrl) {
      const errorText = await initResponse.text()
      throw new Error(`Failed to initiate upload: ${errorText}`)
    }

    // 2. Fetch the video binary from your storage (Supabase/S3)
    const videoResponse = await fetch(video_url)
    if (!videoResponse.ok) throw new Error("Failed to fetch video binary from source")
    
    const videoBlob = await videoResponse.blob()

    // 3. Perform the actual binary upload to YouTube
    const finalResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/*",
        "Content-Length": videoBlob.size.toString(),
      },
      body: videoBlob,
    })

    const finalData = await finalResponse.json()

    return new Response(JSON.stringify({ 
      success: true, 
      youtube_id: finalData.id,
      data: finalData 
    }), { 
      headers: { "Content-Type": "application/json" } 
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    })
  }
})
