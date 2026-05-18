import { z } from "zod"

// ── Step schemas ────────────────────────────────────────────

export const step1Schema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  industry: z.string().min(1, "Please select an industry"),
  niche: z.string().optional(),
})

export const step2Schema = z.object({
  goals: z.array(z.string()).min(1, "Pick at least one goal"),
  posting_frequency: z.enum(["weekly", "monthly"]),
})

export const step3Schema = z.object({
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex colour"),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex colour"),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex colour"),
  font_heading: z.string().min(1),
  font_body: z.string().min(1),
  tagline: z.string().optional(),
  website_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
})

export const step4Schema = z.object({
  target_audience_description: z.string().min(20, "Describe your audience in at least 20 characters"),
  target_age_range: z.string().optional(),
  geographic_location: z.string().optional(),
  tone_adjectives: z.array(z.string()).min(2, "Pick at least 2 tone adjectives"),
  tone_level: z.number().min(1).max(10),
  do_not_mention: z.string().optional(),
})

export const step5Schema = z.object({
  voice_examples: z.string().min(50, "Paste at least one example post (50+ characters)"),
  website_url: z.string().url().optional().or(z.literal("")),
})

export const step9Schema = z.object({
  posting_frequency: z.enum(["weekly", "monthly"]),
  ai_tier: z.enum(["standard", "economy"]).default("standard"),
})

// ── Merged brand draft (all steps combined) ─────────────────

export type OnboardingDraft = {
  // Step 1
  name?: string
  industry?: string
  niche?: string
  // Step 2
  goals?: string[]
  // Step 3
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  font_heading?: string
  font_body?: string
  tagline?: string
  website_url?: string
  // Step 4
  target_audience_description?: string
  target_age_range?: string
  geographic_location?: string
  tone_adjectives?: string[]
  tone_level?: number
  do_not_mention?: string
  // Step 5
  voice_examples?: string
  // Step 6 (AI generated)
  tone_profile?: Record<string, unknown>
  // Step 9
  posting_frequency?: "weekly" | "monthly"
  ai_tier?: "standard" | "economy"
}

export const INDUSTRIES = [
  "Fitness / Physiotherapy",
  "Health & Wellness",
  "Personal Training",
  "Yoga / Pilates",
  "Nutrition / Dietetics",
  "Life Coaching",
  "Business Coaching",
  "Beauty / Hair / Skincare",
  "Photography",
  "Interior Design",
  "Architecture",
  "Law / Legal Services",
  "Accounting / Finance",
  "Marketing / Branding",
  "Real Estate",
  "Education / Tutoring",
  "Other",
]

export const GOALS = [
  { value: "lead_generation", label: "Get more clients" },
  { value: "brand_awareness", label: "Build my brand" },
  { value: "engagement", label: "Educate my audience" },
  { value: "showcase", label: "Showcase my work" },
  { value: "sales", label: "Drive sales" },
]

export const TONE_ADJECTIVES = [
  "Direct",
  "Practical",
  "Warm",
  "Supportive",
  "Professional",
  "Educational",
  "Casual",
  "Friendly",
  "Bold",
  "Energetic",
  "Empathetic",
  "Inspiring",
  "Authoritative",
  "Conversational",
  "Playful",
]

export const FONTS = [
  "Inter",
  "Montserrat",
  "Playfair Display",
  "Lato",
  "Raleway",
  "Poppins",
  "Oswald",
  "Merriweather",
  "Nunito",
  "Open Sans",
]

export const TOTAL_STEPS = 10
