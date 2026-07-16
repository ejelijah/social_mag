import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const body = await req.json()
    console.log("Incoming Request Body:", JSON.stringify(body, null, 2))

    const { message, link, page_id, access_token } = body

    // Validate presence of required fields
    if (!page_id || !access_token) {
      console.error("Error: Missing page_id or access_token in request body.")
      return new Response(
        JSON.stringify({ error: "Missing page_id or access_token" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const fbUrl = `https://graph.facebook.com/v20.0/${page_id}/feed`
    console.log(`Attempting POST to: ${fbUrl}`)

    const response = await fetch(fbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        link: link,
        access_token: access_token,
      }),
    })

    const result = await response.json()
    
    console.log("Facebook API Status:", response.status)
    console.log("Facebook API Response:", JSON.stringify(result, null, 2))

    return new Response(
      JSON.stringify({
        debug: {
          status: response.status,
          ok: response.ok
        },
        fb_response: result
      }), 
      { 
        status: response.status,
        headers: { "Content-Type": "application/json" } 
      }
    )

  } catch (error) {
    console.error("Runtime Error:", error.message)
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

