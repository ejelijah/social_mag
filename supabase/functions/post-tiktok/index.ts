import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { video_url, title, access_token } = await req.json()

  // TikTok Content Posting API (v2)
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
        title: title,
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
    }),
  })

  const result = await response.json()
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } })
})

