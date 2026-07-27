import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { imageUrl } = await req.json()
  const FAL_KEY = Deno.env.get('FAL_KEY')

  try {
    const response = await fetch("https://queue.fal.run/fal-ai/minimax-video/image-to-video", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: imageUrl }),
    })

    const data = await response.json()

    return new Response(
      JSON.stringify({ videoRequestId: data.request_id }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
