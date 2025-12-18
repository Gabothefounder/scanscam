import OpenAI from "openai";

console.log(
  "[ENV CHECK] OPENAI_API_KEY present:",
  !!process.env.OPENAI_API_KEY
);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


export async function callOpenAI(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: prompt,
      },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}
