import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { title, description, video_blob_url, access_token } = await req.json()

  // YouTube Data API v3 - Resumable Upload Initiation
  const response = await fetch(
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

  // This returns a 'Location' header to which you PUT the actual video binary
  const uploadUrl = response.headers.get("Location")
  
  return new Response(JSON.stringify({ upload_url: uploadUrl }), { 
    headers: { "Content-Type": "application/json" } 
  })
})

