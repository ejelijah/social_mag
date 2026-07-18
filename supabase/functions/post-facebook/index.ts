// Using modern Deno.serve syntax and improved error reporting

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("Received Body:", JSON.stringify(body, null, 2))

    const { message, link, page_id, access_token } = body

    // Enhanced validation to tell you exactly what is missing
    if (!page_id || !access_token) {
      const missingFields = []
      if (!page_id) missingFields.push("page_id")
      if (!access_token) missingFields.push("access_token")

      console.error(`Validation Error: Missing ${missingFields.join(" and ")}`)
      
      return new Response(
        JSON.stringify({ 
          error: `Missing required fields: ${missingFields.join(", ")}`,
          received_keys: Object.keys(body) 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    const fbUrl = `https://graph.facebook.com/v20.0/${page_id}/feed`
    console.log(`Posting to Facebook Page: ${page_id}`)

    const response = await fetch(fbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        link,
        access_token,
      }),
    })

    const result = await response.json()
    console.log("Facebook Response Status:", response.status)

    return new Response(
      JSON.stringify({
        ok: response.ok,
        fb_response: result
      }), 
      { 
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )

  } catch (error) {
    console.error("Critical Runtime Error:", error.message)
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})

