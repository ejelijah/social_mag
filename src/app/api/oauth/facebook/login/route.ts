import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  
  const redirectUri = `${origin}/api/oauth/facebook/callback`;

  // --- DEBUG MODE: Uncomment the block below to see the origin in your browser ---

  return new Response(JSON.stringify({ 
    origin: origin, 
    fullRedirectUri: redirectUri 
  }), {
    headers: { "Content-Type": "application/json" },
  });
}
  // ------------------------------------------------------------------------------

//   const { data, error } = await supabase.auth.signInWithOAuth({
//     provider: "facebook",
//     options: {
//       redirectTo: redirectUri,
//       // Strictly Facebook Page permissions
//       scopes: "public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts",
//     },
//   });

//   if (error) {
//     return NextResponse.redirect(`${origin}/dashboard/accounts?error=${error.message}`);
//   }

//   if (data.url) {
//     return NextResponse.redirect(data.url);
//   }

//   return NextResponse.redirect(`${origin}/dashboard/accounts?error=No+URL+returned`);
// }