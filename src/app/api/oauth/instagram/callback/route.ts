import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_UR || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Webhook Verification (GET)
  if (req.method === 'GET' && req.query['hub.mode'] === 'subscribe') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === 'my_secret_omni_token_123') {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('Verification failed');
    }
  }

  // 2. OAuth Callback & Token Exchange (GET)
  if (req.method === 'GET' && req.query.code) {
    const { code, state } = req.query;

    try {
      // A. Exchange code for Short-Lived Access Token
      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: process.env.INSTAGRAM_APP_ID || '',
          client_secret: process.env.INSTAGRAM_APP_SECRET || '',
          grant_type: 'authorization_code',
          redirect_uri: 'https://omnipost.one/api/oauth/instagram/callback',
          code: Array.isArray(code) ? code[0] : code || '',
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) throw new Error(tokenData.error_message);

      const shortLivedToken = tokenData.access_token;
      const instagramUserId = tokenData.user_id;

      // B. Exchange for Long-Lived Access Token (60 days)
      const longLivedResponse = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`
      );
      
      const longLivedData = await longLivedResponse.json();
      const finalToken = longLivedData.access_token;

      // C. Save to Supabase
      const { error } = await supabase
        .from('user_connections')
        .upsert({
          user_id: state, // Linking back via the state parameter
          platform: 'instagram',
          access_token: finalToken,
          platform_user_id: instagramUserId,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      return res.redirect('/dashboard?connection=success');
    } catch (error) {
      console.error('Instagram Auth Error:', error);
      return res.redirect('/dashboard?connection=error');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}