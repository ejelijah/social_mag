import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { prompt } = await req.json()
  const GOOGLE_KEY = Deno.env.get('GEMEINI_API_KEY')

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate a high-quality image for: ${prompt}` }] }]
      })
    })

    const data = await response.json()
    // Extract the image URL or base64 from Gemini's response
    const imageUrl = data.candidates[0].content.parts[0].text 

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})











