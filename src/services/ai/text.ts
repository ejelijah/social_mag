import { generateTextWithGemini } from "./gemini";
import { generateTextWithGroq } from "./groq";
import { generateTextWithMistral } from "./mistral";

export type TextModel = "gemini" | "groq" | "mistral";

export async function generateText(
  prompt: string,
  model: TextModel = "gemini"
): Promise<string> {
  switch (model) {
    case "gemini":
      return generateTextWithGemini(prompt);
    case "groq":
      return generateTextWithGroq(prompt);
    case "mistral":
      return generateTextWithMistral(prompt);
    default:
      return generateTextWithGemini(prompt);
  }
}

export function getAvailableTextModels(): TextModel[] {
  const models: TextModel[] = [];
  if (process.env.GEMINI_API_KEY) models.push("gemini");
  if (process.env.GROQ_API_KEY) models.push("groq");
  if (process.env.MISTRAL_API_KEY) models.push("mistral");
  return models.length > 0 ? models : ["gemini"];
}
