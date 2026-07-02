import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { image_url, caption, ig_user_id, access_token } = await req.json()

  // Step 1: Create Media Container
  const containerRes = await fetch(
    `https://graph.facebook.com/v20.0/${ig_user_id}/media?image_url=${encodeURIComponent(image_url)}&caption=${encodeURIComponent(caption)}&access_token=${access_token}`,
    { method: "POST" }
  )
  const { id: creation_id } = await containerRes.json()

  // Step 2: Publish Container (Wait a few seconds for processing in production)
  const publishRes = await fetch(
    `https://graph.facebook.com/v20.0/${ig_user_id}/media_publish?creation_id=${creation_id}&access_token=${access_token}`,
    { method: "POST" }
  )

  const result = await publishRes.json()
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } })
})

