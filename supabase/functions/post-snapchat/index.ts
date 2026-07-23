import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Refreshes the Snapchat OAuth2 access token using the refresh token.
 */
async function refreshSnapchatTokens(supabase: any, user_id: string, refreshToken: string) {
  console.log(`[DEBUG] Attempting to refresh Snapchat token for user: ${user_id}`);
  
  const clientID = Deno.env.get('SNAPCHAT_CLIENT_ID');
  const clientSecret = Deno.env.get('SNAPCHAT_CLIENT_SECRET');

  if (!clientID || !clientSecret) {
    console.error("[ERROR] Missing Snapchat credentials in environment variables.");
    throw new Error("Server configuration error");
  }

  const response = await fetch('https://accounts.snapchat.com/accounts/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientID,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await response.json()
  
  if (!response.ok) {
    console.error(`[ERROR] Snapchat API refresh failed: ${JSON.stringify(tokens)}`);
    throw new Error(`Snapchat refresh failed: ${tokens.error_description || tokens.error}`);
  }

  console.log(`[DEBUG] Successfully received new tokens from Snapchat.`);

  // Update the database with new tokens and a fresh expiry timestamp
  const { error: updateError } = await supabase.from('social_accounts').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || refreshToken, // Fallback to old refresh token if a new one isn't provided
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', user_id).eq('platform', 'snapchat')

  if (updateError) {
    console.error(`[ERROR] Failed to update social_accounts table: ${updateError.message}`);
    throw new Error("Database update failed");
  }

  return tokens.access_token
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log(`[DEBUG] ${req.method} request received at ${new Date().toISOString()}`);

    // Validate Environment Variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get User from Auth Header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) throw new Error("No authorization header provided");

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      console.error(`[ERROR] Auth validation failed: ${authError?.message}`);
      throw new Error("Unauthorized");
    }

    console.log(`[DEBUG] Authenticated user: ${user.id}`);

    // Fetch linked Snapchat account
    const { data: acc, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'snapchat')
      .single();

    if (dbError || !acc) {
      console.error(`[ERROR] Snapchat account lookup failed: ${dbError?.message}`);
      throw new Error("Snapchat account not linked or not found");
    }

    let token = acc.access_token;
    const expiresAt = new Date(acc.expires_at).getTime();
    const now = Date.now();
    const buffer = 300000; // 5 minute buffer

    // Check if token is expired or expiring soon
    if (expiresAt < now + buffer) {
      console.log(`[DEBUG] Token expired or expiring soon. Refreshing...`);
      token = await refreshSnapchatTokens(supabase, user.id, acc.refresh_token);
    } else {
      console.log(`[DEBUG] Current access token is still valid.`);
    }

    // Logic for Snapchat Business/Spotlight API would go here using 'token'
    // const { content } = await req.json(); // If you need to process body content

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Authentication successful", 
        access_token: token // Optional: return token if needed by client
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`[FATAL ERROR] ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
