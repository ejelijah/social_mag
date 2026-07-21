import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Helper function to refresh the YouTube Access Token using the Refresh Token
 */
async function refreshYoutubeToken(supabase: any, userId: string, refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to refresh Google token: ${data.error_description || data.error}`);
  }

  // Update the new access token in your database
  const { error: updateError } = await supabase
    .from("social_accounts")
    .update({ 
      access_token: data.access_token,
      updated_at: new Date().toISOString() 
    })
    .match({ user_id: userId, platform: "youtube" });

  if (updateError) throw new Error(`Database update failed: ${updateError.message}`);

  return data.access_token;
}

serve(async (req) => {
  try {
    const { title, description, video_url, user_id } = await req.json();

    // 1. Initialize Supabase with Service Role Key to bypass RLS for background processing
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Fetch the latest credentials for this user
    const { data: account, error: dbError } = await supabase
      .from("social_accounts")
      .select("*")
      .match({ user_id: user_id, platform: "youtube" })
      .single();

    if (dbError || !account) throw new Error("YouTube account not connected or not found.");

    let accessToken = account.access_token;

    // 3. Check if token is expired (Google tokens last 3600 seconds)
    // If it was updated more than 50 minutes ago, refresh it to be safe
    const lastUpdated = new Date(account.updated_at).getTime();
    const now = new Date().getTime();
    const fiveMinutesInMs = 50 * 60 * 1000;

    if (now - lastUpdated > fiveMinutesInMs && account.refresh_token) {
      console.log("DEBUG: Token expired. Refreshing...");
      accessToken = await refreshYoutubeToken(supabase, user_id, account.refresh_token);
    }

    // 4. Initiate Resumable Upload with YouTube
    const initResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/*",
        },
        body: JSON.stringify({
          snippet: {
            title: title.substring(0, 100), // YouTube title limit
            description: description,
            categoryId: "22", 
          },
          status: {
            privacyStatus: "public",
          },
        }),
      }
    );

    const uploadUrl = initResponse.headers.get("Location");
    if (!uploadUrl) {
      const errorText = await initResponse.text();
      // If we get a 401 here, the token refresh logic above might have failed or the token was revoked
      throw new Error(`YouTube Upload Initiation Failed: ${errorText}`);
    }

    // 5. Fetch the video binary from your storage
    const videoResponse = await fetch(video_url);
    if (!videoResponse.ok) throw new Error("Failed to fetch video from storage URL.");
    
    const videoBlob = await videoResponse.blob();

    // 6. Perform the actual binary upload
    const finalResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/*",
        "Content-Length": videoBlob.size.toString(),
      },
      body: videoBlob,
    });

    const finalData = await finalResponse.json();

    if (!finalResponse.ok) {
      throw new Error(`YouTube Binary Upload Failed: ${JSON.stringify(finalData)}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      youtube_id: finalData.id,
      details: "Upload successful"
    }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("CRITICAL ERROR:", error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    });
  }
})
