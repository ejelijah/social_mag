export async function generateImageWithPollinations(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}`;
}

export async function generateImageWithHuggingFace(prompt: string): Promise<string> {
  const token = process.env.HUGGINGFACE_TOKEN;
  if (!token) throw new Error("HUGGINGFACE_TOKEN is not configured");

  const res = await fetch(
    "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Hugging Face API error: ${err}`);
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}

export type ImageModel = "pollinations" | "huggingface";

export async function generateImage(
  prompt: string,
  model: ImageModel = "pollinations"
): Promise<string> {
  switch (model) {
    case "pollinations":
      return generateImageWithPollinations(prompt);
    case "huggingface":
      return generateImageWithHuggingFace(prompt);
    default:
      return generateImageWithPollinations(prompt);
  }
}
