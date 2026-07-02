import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { message, link, page_id, access_token } = await req.json()

  // Post to Facebook Page Feed
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${page_id}/feed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        link: link,
        access_token: access_token,
      }),
    }
  )

  const result = await response.json()
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } })
})

