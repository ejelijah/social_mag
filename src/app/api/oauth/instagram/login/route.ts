import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const redirectUri = `${origin}/api/oauth/instagram/callback`;

  // --- DEBUG MODE: Visit this URL in your browser to see the values ---
  return new Response(JSON.stringify({ 
    origin: origin, 
    fullRedirectUri: redirectUri,
    instructions: "Copy the fullRedirectUri above and add it to your Facebook App settings under 'Valid OAuth Redirect URIs'"
  }), {
    headers: { "Content-Type": "application/json" },
  });
  // --------------------------------------------------------------------

//   const { data: { user } } = await supabase.auth.getUser();
//   if (!user) return NextResponse.redirect(`${origin}/login`);

//   const { data, error } = await supabase.auth.signInWithOAuth({
//     provider: "facebook", 
//     options: {
//       redirectTo: redirectUri, 
//       scopes: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
//       queryParams: {
//         state: user.id,
//         auth_type: 'rerequest' 
//       }
//     },
//   });

//   if (error) return NextResponse.redirect(`${origin}/dashboard/accounts?error=${error.message}`);
//   return NextResponse.redirect(data.url);
}