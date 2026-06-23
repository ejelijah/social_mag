import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('NEWS_API_KEY')
    
    // We'll fetch top technology headlines in the US as "Trending"
    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?country=us&category=technology&pageSize=5&apiKey=${apiKey}`
    )

    const data = await response.json()

    // NewsAPI returns "articles". We need to map them to your "topics" format
    const topics = data.articles.map((article: any, index: number) => ({
      id: index + 1,
      topic: article.title,
      category: "News",
      description: article.description
    }))

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})



