import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const connectInstagram = async () => {
    // 1. Get the current authenticated user from Supabase
    const { data: { user } } = await supabase.auth.getUser();
  
    if (!user) {
      console.error("No active session found");
      return;
    }
  
    // 2. Fetch the user's name from the 'names' table
    const { data: profile, error } = await supabase
      .from('users')
      .select('name') // Adjust this if your column name is different (e.g., 'full_name')
      .eq('id', user.id)
      .single();
  
    if (error) {
      console.error("Error fetching user name:", error);
    }
  
    // 3. Construct the Instagram OAuth URL
    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID;
    const redirectUri = encodeURIComponent('https://omnipost.one/api/oauth/instagram/callback');
    const scope = 'instagram_basic,instagram_content_publish';
    
    // We use the user.id as the state to ensure the callback can identify the user
    const state = user.id;
  
    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${state}`;
  
    // 4. Redirect the user to Instagram
    window.location.href = authUrl;
  };