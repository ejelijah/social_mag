"use server";

import { Message } from "@/components/ui/AIchatbot"; // Adjust path to where your component is

export async function invokeGrok(messages: Message[]) {
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-beta", // or "grok-2"
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API Error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Chat Error:", error);
    throw new Error("Failed to get response from Grok");
  }
}