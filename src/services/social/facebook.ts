import type { SocialAccount } from "@/types/social";

export async function postToFacebook(
  account: SocialAccount,
  content: { text: string; imageUrl?: string }
): Promise<{ id: string }> {
  const { accessToken, providerId } = account;
  if (!providerId) {
    throw new Error("Facebook requires provider_id (page id) on the connected account");
  }
  const baseUrl = "https://graph.facebook.com/v21.0";

  const params = new URLSearchParams({
    message: content.text,
    access_token: accessToken,
  });

  if (content.imageUrl) {
    params.set("url", content.imageUrl);
  }

  const res = await fetch(
    `${baseUrl}/${providerId}/feed?${params.toString()}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Facebook API error: ${err}`);
  }

  const data = await res.json();
  return { id: data.id };
}
