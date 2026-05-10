export type PostType = "single_image" | "carousel" | "text_only" | "quote" | "story" | "reel" | "testimonial" | "behind_the_scenes"

export type ContentPillar = "education" | "motivation" | "community" | "promotional" | "behind_the_scenes"

export type Platform = "instagram" | "linkedin" | "facebook" | "tiktok" | "x" | "threads"

export interface PostTemplate {
  id: string
  name: string
  description: string
  post_type: PostType
  best_for: Platform[]
  content_pillars: ContentPillar[]
  /** How many media items this template expects (0 = text-only) */
  media_count: number
  caption_style: string
  hashtag_count: { min: number; max: number }
  prompt_hint: string
}

export const DEFAULT_TEMPLATES: PostTemplate[] = [
  {
    id: "edu-tips",
    name: "Educational Tips",
    description: "Share actionable tips your audience can use today.",
    post_type: "single_image",
    best_for: ["instagram", "linkedin", "facebook"],
    content_pillars: ["education"],
    media_count: 1,
    caption_style: "Opens with a bold statement or question. Lists 3–5 practical tips. Ends with a CTA.",
    hashtag_count: { min: 5, max: 15 },
    prompt_hint: "Write a tip-based educational post. Start with a hook, give 3–5 numbered tips, close with a question or CTA.",
  },
  {
    id: "myth-bust",
    name: "Myth Buster",
    description: "Debunk a common misconception in your industry.",
    post_type: "single_image",
    best_for: ["instagram", "linkedin", "facebook", "threads"],
    content_pillars: ["education"],
    media_count: 1,
    caption_style: "Opens with 'MYTH:'. States the myth, then busts it with evidence. Ends with the truth.",
    hashtag_count: { min: 5, max: 12 },
    prompt_hint: "Write a myth-busting post. Start with 'MYTH: [misconception]', then reveal the truth with supporting reasoning.",
  },
  {
    id: "story-result",
    name: "Client Result / Story",
    description: "Share a client transformation or success story.",
    post_type: "single_image",
    best_for: ["instagram", "facebook"],
    content_pillars: ["community", "promotional"],
    media_count: 1,
    caption_style: "Short narrative: before → turning point → result. Ends with a soft CTA.",
    hashtag_count: { min: 5, max: 10 },
    prompt_hint: "Write a client success story post using a before/after narrative arc. Keep it specific and authentic.",
  },
  {
    id: "carousel-edu",
    name: "Educational Carousel",
    description: "Multi-slide carousel that teaches one concept step by step.",
    post_type: "carousel",
    best_for: ["instagram", "linkedin"],
    content_pillars: ["education"],
    media_count: 5,
    caption_style: "Short teaser caption with 'Swipe →' CTA. Each slide has one clear point.",
    hashtag_count: { min: 8, max: 15 },
    prompt_hint: "Write a carousel post teaser. Keep the caption short (2–3 lines) and end with 'Swipe → to learn more'.",
  },
  {
    id: "behind-scenes",
    name: "Behind the Scenes",
    description: "Show what goes on behind your business — builds trust.",
    post_type: "behind_the_scenes",
    best_for: ["instagram", "facebook", "threads"],
    content_pillars: ["behind_the_scenes", "community"],
    media_count: 1,
    caption_style: "Conversational and personal tone. Shares a slice of daily work life. Low-pressure CTA.",
    hashtag_count: { min: 3, max: 8 },
    prompt_hint: "Write a behind-the-scenes post that feels personal and authentic. Share a moment from daily work life.",
  },
  {
    id: "quote-insight",
    name: "Quote / Insight",
    description: "A powerful quote or personal insight overlaid on an image.",
    post_type: "quote",
    best_for: ["instagram", "linkedin", "threads"],
    content_pillars: ["motivation"],
    media_count: 1,
    caption_style: "Quote or bold statement on the image. Caption expands the thought in 2–3 sentences.",
    hashtag_count: { min: 3, max: 8 },
    prompt_hint: "Write a quote-style post. The quote goes on the image; the caption elaborates in 2–3 short sentences.",
  },
  {
    id: "linkedin-thought",
    name: "LinkedIn Thought Leadership",
    description: "Long-form professional insight for LinkedIn.",
    post_type: "text_only",
    best_for: ["linkedin"],
    content_pillars: ["education", "motivation"],
    media_count: 0,
    caption_style: "Opens with a bold one-liner. Uses short paragraphs and line breaks. Ends with a question.",
    hashtag_count: { min: 3, max: 5 },
    prompt_hint: "Write a LinkedIn thought-leadership post. Bold opener, short punchy paragraphs, professional but personal tone. End with a question to drive comments.",
  },
  {
    id: "promo-offer",
    name: "Promotional Offer",
    description: "Announce a service, programme, or limited-time offer.",
    post_type: "single_image",
    best_for: ["instagram", "facebook", "linkedin"],
    content_pillars: ["promotional"],
    media_count: 1,
    caption_style: "Lead with the outcome, not the price. Clear benefit statement. Strong CTA with link/DM.",
    hashtag_count: { min: 5, max: 10 },
    prompt_hint: "Write a promotional post for a service or offer. Lead with the transformation/outcome, describe who it's for, end with a clear CTA.",
  },
]

export function getTemplate(id: string): PostTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.id === id)
}
