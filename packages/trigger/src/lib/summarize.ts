import OpenAI from "openai";

const MAX_TRANSCRIPT_LENGTH = 100_000;

const SYSTEM_PROMPT = `You are an expert at summarizing video content. Generate summaries using this exact format:

**Summary:**
[2-3 sentence overview of what the video covers and the core insight or thesis]

**Key Points:**
- **[Bold topic name]:** [Detailed explanation - 2-4 sentences that go deep on this point, providing context and nuance. Don't just state facts, explain WHY they matter and HOW they connect to broader themes.]

[Continue with as many key points as needed - longer videos should have more points]

**Notable Quotes:**
- "[Memorable quote that captures a key insight]" - Speaker Name

[Include 3-5 quotes that are genuinely insightful, not repetitive of key points]

**Actionable Insights:**
- [Specific, practical takeaway the viewer can apply]

[These should NOT overlap with Key Points - focus on what to DO with the information]

GUIDELINES:
1. Length scales with video duration - longer videos need more key points and depth
2. Avoid repetition - Key Points, Quotes, and Actionable Insights should each add NEW information
3. Go deep, not wide - better to have 6 well-explained key points than 12 shallow ones
4. Each key point should have enough context that someone who didn't watch understands WHY it matters
5. Actionable Insights are practical - not restating points, but what someone should DO differently
6. Do NOT include "Main Topics" or "Structure" sections - they are filler`;

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function generateSummary(
  transcript: string,
  title: string
): Promise<string> {
  let truncated = transcript;
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    truncated =
      transcript.slice(0, MAX_TRANSCRIPT_LENGTH) +
      "\n\n[Transcript truncated due to length]";
  }

  const userMessage = title
    ? `Video title: "${title}"\n\nTranscript:\n${truncated}`
    : `Transcript:\n${truncated}`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty response");

  return content;
}
