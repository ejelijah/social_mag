import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`Incoming request: ${req.method}`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Debug: Read raw text first
    const rawBody = await req.text()
    console.log("Raw Request Body:", rawBody)

    if (!rawBody) {
      throw new Error("Request body is empty")
    }

    const { imageUrl } = JSON.parse(rawBody)
    const FAL_KEY = Deno.env.get('FAL_KEY')

    console.log(`Calling Fal.ai for image: ${imageUrl}`)

    const response = await fetch("https://queue.fal.run/fal-ai/minimax-video/image-to-video", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: imageUrl }),
    })

    // Debug: Check external API response
    const responseText = await response.text()
    console.log("Fal.ai Raw Response:", responseText)

    if (!response.ok) {
      throw new Error(`Fal.ai API error (${response.status}): ${responseText}`)
    }

    const data = JSON.parse(responseText)

    return new Response(
      JSON.stringify({ videoRequestId: data.request_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Function Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }), 
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
