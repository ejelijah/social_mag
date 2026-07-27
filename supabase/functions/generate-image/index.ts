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
    // Debug: Read raw text first to see if it's empty
    const rawBody = await req.text()
    console.log("Raw Request Body:", rawBody)

    if (!rawBody) {
      throw new Error("Request body is empty")
    }

    const { prompt } = JSON.parse(rawBody)
    const GOOGLE_KEY = Deno.env.get('GEMEINI_API_KEY')

    console.log(`Calling Gemini for prompt: ${prompt}`)

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate a high-quality image for: ${prompt}` }] }]
      })
    })

    // Debug: Check external API response
    const responseText = await response.text()
    console.log("Gemini Raw Response:", responseText)

    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status}): ${responseText}`)
    }

    const data = JSON.parse(responseText)
    const imageUrl = data.candidates[0].content.parts[0].text 

    return new Response(
      JSON.stringify({ imageUrl }),
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











