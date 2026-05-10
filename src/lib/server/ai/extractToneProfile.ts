import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

export type ToneProfile = {
  personality_traits: string[]
  tone_level: number           // 1 = very formal, 10 = very casual
  expertise_level: string
  writing_style: {
    sentence_length: string
    vocabulary: string
    perspective: string
    formatting: string
  }
  signature_phrases: string[]
  do_use: string[]
  do_not_use: string[]
  cta_style: string
  emoji_usage: string
}

export async function extractToneProfile(
  examples: string,
  brandName: string,
  industry: string,
  adjectives: string[],
  toneLevel: number
): Promise<ToneProfile> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a brand voice analyst. Analyse these social media posts and extract a structured tone-of-voice profile for ${brandName}, a ${industry} brand.

BRAND PERSONALITY (self-described): ${adjectives.join(", ")}
DESIRED TONE LEVEL: ${toneLevel}/10 (1=very formal, 10=very casual)

EXAMPLE POSTS:
${examples}

Return ONLY valid JSON matching this exact structure — no explanation, no markdown:
{
  "personality_traits": ["trait1", "trait2", "trait3"],
  "tone_level": ${toneLevel},
  "expertise_level": "professional|accessible|expert|beginner-friendly",
  "writing_style": {
    "sentence_length": "short|short_to_medium|medium|long",
    "vocabulary": "simple|accessible_with_terminology|technical|jargon-free",
    "perspective": "first_person|second_person|third_person|mixed",
    "formatting": "prose|bullet_friendly|numbered|mixed"
  },
  "signature_phrases": ["phrase1", "phrase2"],
  "do_use": ["pattern1", "pattern2", "pattern3"],
  "do_not_use": ["avoid1", "avoid2"],
  "cta_style": "direct_action|soft_invite|question|urgency",
  "emoji_usage": "none|minimal|moderate|heavy"
}`,
      },
    ],
  })

  const raw   = response.content[0].type === "text" ? response.content[0].text : ""
  // Strip markdown code fences that Claude occasionally adds despite being asked not to
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
  return JSON.parse(clean) as ToneProfile
}
