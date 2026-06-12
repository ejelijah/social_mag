import type { SocialAccount } from "@/types/social";

export async function postToLinkedIn(
  account: SocialAccount,
  content: { text: string; imageUrl?: string }
): Promise<{ id: string }> {
  const { accessToken } = account;
  const baseUrl = "https://api.linkedin.com/v2";

  const body: Record<string, unknown> = {
    author: "urn:li:person:me",
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content.text },
        shareMediaCategory: "NONE",
      },
    },
  };

  if (content.imageUrl) {
    (body.specificContent as Record<string, unknown>)["com.linkedin.ugc.ShareContent"] = {
      shareCommentary: { text: content.text },
      shareMediaCategory: "IMAGE",
      media: [
        {
          status: "READY",
          media: content.imageUrl,
        },
      ],
    };
  }

  const res = await fetch(`${baseUrl}/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn API error: ${err}`);
  }

  const data = await res.json();
  return { id: data.id };
}
