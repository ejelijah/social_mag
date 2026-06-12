import type { SocialAccount } from "@/types/social";

function isXDebugEnabled() {
  return process.env.SOCIAL_DEBUG === "1" || process.env.X_DEBUG === "1";
}

export async function postToX(
  account: SocialAccount,
  content: { text: string; imageUrl?: string }
): Promise<{ id: string }> {
  const { accessToken } = account;
  const baseUrl = "https://api.x.com/2/";

  const debug = isXDebugEnabled();

  const body: Record<string, unknown> = {
    text: content.text.slice(0, 280),
  };

  if (content.imageUrl) {
    body.media = { media_ids: [] };
  }

  const url = `${baseUrl}/tweets`;
  if (debug) {
    console.log("[postToX] request", {
      url,
      textLength: typeof body.text === "string" ? (body.text as string).length : null,
      hasImageUrl: Boolean(content.imageUrl),
      hasMediaField: "media" in body,
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (debug) {
    console.log("[postToX] response", {
      status: res.status,
      ok: res.ok,
      rateLimit: {
        limit: res.headers.get("x-rate-limit-limit"),
        remaining: res.headers.get("x-rate-limit-remaining"),
        reset: res.headers.get("x-rate-limit-reset"),
      },
      bodyPreview: raw.slice(0, 500),
    });
  }

  if (!res.ok) throw new Error(`X API error (${res.status}): ${raw}`);

  const data = JSON.parse(raw);
  return { id: data.data.id };
}
