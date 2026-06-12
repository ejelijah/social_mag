const Groq = require("groq-sdk");
const groq = new Groq({apiKey: process.env.GROQ_API_KEY});

async function generateSocialPost(topic, platform, length) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a social media manager. Create a ${platform} post. 
                  Length constraint: ${length}.`
      },
      {
        role: "user",
        content: `Topic: ${topic}`
      }
    ],
    model: "llama-3.1-70b-versatile",
  });
  return chatCompletion.choices[0].message.content;
}