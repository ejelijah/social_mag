import type { SocialAccount } from "@/types/social";

export async function postToInstagram(
  account: SocialAccount,
  content: { text: string; imageUrl: string }
): Promise<{ id: string }> {
  const { accessToken } = account;
  const baseUrl = "https://graph.instagram.com";

  const containerRes = await fetch(
    `${baseUrl}/v18.0/me/media?image_url=${encodeURIComponent(content.imageUrl)}&caption=${encodeURIComponent(content.text)}&access_token=${accessToken}`,
    { method: "POST" }
  );

  if (!containerRes.ok) {
    const err = await containerRes.text();
    throw new Error(`Instagram API error: ${err}`);
  }

  const container = await containerRes.json();
  const containerId = container.id;

  const publishRes = await fetch(
    `${baseUrl}/v18.0/me/media_publish?creation_id=${containerId}&access_token=${accessToken}`,
    { method: "POST" }
  );

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`Instagram publish error: ${err}`);
  }

  const publish = await publishRes.json();
  return { id: publish.id };
}
