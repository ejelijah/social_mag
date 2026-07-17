import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// 1. Define CORS headers to allow your frontend to call this function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 2. Handle CORS Preflight requests
  // Without this, browser calls will fail "silently" due to CORS errors
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("Incoming Request Body:", JSON.stringify(body, null, 2))

    const { message, link, page_id, access_token } = body

    if (!page_id || !access_token) {
      console.error("Error: Missing page_id or access_token.")
      return new Response(
        JSON.stringify({ error: "Missing page_id or access_token" }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    const fbUrl = `https://graph.facebook.com/v20.0/${page_id}/feed`
    
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
    
    return new Response(
      JSON.stringify({
        debug: { status: response.status, ok: response.ok },
        fb_response: result
      }), 
      { 
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )

  } catch (error) {
    console.error("Runtime Error:", error.message)
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})

