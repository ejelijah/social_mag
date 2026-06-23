import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { prompt } = await req.json()
  
  const GOOGLE_KEY = Deno.env.get('GEMEINI_API_KEY')
  const FAL_KEY = Deno.env.get('FAL_KEY')

  try {
    // 1. Generate Image with Google Nano Banana (Gemini)
    const imageResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_KEY}`, {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate a high-quality image for: ${prompt}` }] }]
      })
    })
    const imageData = await imageResponse.json()
    const imageUrl = imageData.candidates[0].content.parts[0].text // Simplify based on exact API return

    // 2. Pass Image URL to Fal.ai for Video (Hailuo/MiniMax)
    const videoResponse = await fetch("https://queue.fal.run/fal-ai/minimax-video/image-to-video", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: imageUrl }),
    })
    const videoData = await videoResponse.json()

    // 3. Return the results to your app
    return new Response(
      JSON.stringify({ image: imageUrl, video: videoData.request_id }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})











