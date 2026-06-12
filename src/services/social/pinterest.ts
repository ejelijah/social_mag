import type { SocialAccount } from "@/types/social";

export async function postToPinterest(
  account: SocialAccount,
  content: { text: string; imageUrl: string; link?: string }
): Promise<{ id: string }> {
  const { accessToken } = account;
  const baseUrl = "https://api.pinterest.com/v5/pins";

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      board_id: (account.metadata as { boardId?: string })?.boardId ?? "default",
      title: content.text.slice(0, 100),
      description: content.text,
      media_source: {
        source_type: "image_url",
        url: content.imageUrl,
      },
      link: content.link ?? "",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinterest API error: ${err}`);
  }

  const data = await res.json();
  return { id: data.id };
}
