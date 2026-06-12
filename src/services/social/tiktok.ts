import type { SocialAccount } from "@/types/social";

export async function postToTikTok(
  account: SocialAccount,
  content: { text: string; videoUrl: string }
): Promise<{ id: string }> {
  const { accessToken } = account;
  const baseUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: {
        title: content.text.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_comment: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_URL",
        video_url: content.videoUrl,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TikTok API error: ${err}`);
  }

  const data = await res.json();
  return { id: data.data.publish_id };
}
