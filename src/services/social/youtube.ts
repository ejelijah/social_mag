import type { SocialAccount } from "@/types/social";

export async function postToYouTube(
  account: SocialAccount,
  content: { title: string; description: string; videoUrl?: string; tags?: string[] }
): Promise<{ id: string }> {
  const { accessToken } = account;
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  const snippet = {
    title: content.title.slice(0, 100),
    description: content.description,
    tags: content.tags ?? [],
    categoryId: "22",
  };

  const body = {
    snippet,
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const res = await fetch(`${baseUrl}/videos?part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube API error: ${err}`);
  }

  const data = await res.json();
  return { id: data.id };
}
