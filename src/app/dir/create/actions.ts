"use server";

export async function getTrendingTopics() {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-beta",
      messages: [
        { role: "system", content: "Return a JSON object with a key 'topics' containing an array of 5 current trending social media topics." },
        { role: "user", content: "What is trending right now?" }
      ],
      response_format: { type: "json_object" }
    }),
  });

  const data = await response.json();
  const content = JSON.parse(data.choices[0].message.content);
  return content.topics || [];
}