import Anthropic from "@anthropic-ai/sdk"
import type { ToneProfile } from "./extractToneProfile"

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

const GOAL_LABELS: Record<string, string> = {
  lead_generation: "Get more clients",
  brand_awareness: "Build brand awareness",
  engagement: "Educate / engage the audience",
  showcase: "Showcase work / results",
  sales: "Drive sales",
}

export async function generateSamplePost(
  brandName: string,
  industry: string,
  audience: string,
  toneProfile: ToneProfile,
  examples: string,
  doNotMention?: string,
  previousFeedback?: string,
  goals?: string[] | null,
): Promise<{ caption: string; hashtags: string[] }> {
  const feedbackLine = previousFeedback
    ? `\nPREVIOUS FEEDBACK TO ADDRESS: ${previousFeedback}\n`
    : ""

  const goalsDesc = goals?.length
    ? `\nCONTENT GOALS (priority order):\n${goals.map((g, i) => `  ${i === 0 ? "★ Primary" : `  ${i + 1}.`} ${GOAL_LABELS[g] ?? g}`).join("\n")}\nThe post must primarily serve the PRIMARY goal.\n`
    : ""

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Write a sample Instagram post for ${brandName}, a ${industry} brand.

BRAND VOICE PROFILE:
${JSON.stringify(toneProfile, null, 2)}

EXAMPLES OF THEIR VOICE:
${examples}

TARGET AUDIENCE: ${audience}
${goalsDesc}
${doNotMention ? `DO NOT MENTION: ${doNotMention}` : ""}
${feedbackLine}

Write the post in ${toneProfile?.content_language ?? "the same language as the examples above"}.
Write an engaging post that demonstrates their authentic voice. Return ONLY valid JSON — no explanation:
{
  "caption": "the full caption text",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}`,
      },
    ],
  })

  const raw   = response.content[0].type === "text" ? response.content[0].text : ""
  // Strip markdown code fences that Claude occasionally adds despite being asked not to
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
  return JSON.parse(clean) as { caption: string; hashtags: string[] }
}
