/**
 * POST /api/ai/extract-brand-from-document
 *
 * Accepts a brand guide, ToV document, or any company document and extracts
 * structured brand data from it using Claude. Returns a partial OnboardingDraft
 * so the wizard can pre-fill as many steps as possible.
 *
 * Returns:
 *   {
 *     name?:                       string   — business name
 *     niche?:                      string   — specific niche / what makes them different
 *     tagline?:                    string   — brand tagline or slogan
 *     website_url?:                string   — website if mentioned
 *     target_audience_description?: string  — who they serve
 *     geographic_location?:        string   — city / region / country if mentioned
 *     voice_examples?:             string   — writing examples separated by ---
 *     goals?:                      string[] — recognised goal keys
 *   }
 *
 * Any field not found in the document is omitted (caller merges with existing draft).
 */

import { NextResponse }       from "next/server"
import Anthropic              from "@anthropic-ai/sdk"
import mammoth                from "mammoth"
import { MODELS }             from "@/lib/ai/models"
import { logAiUsage }         from "@/lib/ai/logUsage"
import { createClient }       from "@/lib/supabase/server"

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

const MAX_FILE_SIZE  = 10 * 1024 * 1024
const MAX_TEXT_CHARS = 60_000

const SUPPORTED_TYPES: Record<string, string> = {
  "application/pdf":                                                        "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword":                                                     "docx",
  "text/plain":                                                             "txt",
  "text/markdown":                                                          "txt",
}

// Goal keys that match the postflow goals system
const KNOWN_GOALS = [
  "grow_audience", "convert_clients", "build_authority",
  "educate_audience", "increase_engagement", "drive_traffic",
  "promote_services", "build_community",
]

const EXTRACT_PROMPT = (rawText: string) => `
You are reading a brand guide, tone-of-voice document, or company document.
Extract all of the following that you can find. Return ONLY a JSON object — no markdown, no explanation.

Fields to extract (omit any you cannot find or infer with confidence):
- "name": string — the business or brand name
- "niche": string — a short, specific description of what makes this brand/audience unique (max 80 chars)
- "tagline": string — the brand's tagline or slogan if present
- "website_url": string — the website URL if mentioned (must start with https://)
- "target_audience_description": string — who they serve, in plain language (max 120 chars)
- "geographic_location": string — city, region, or country if mentioned
- "voice_examples": string — 3–8 representative sentences/passages that show HOW they write (tone, style, vocabulary). Separate examples with the literal string "---" on its own line. Include finished captions or copy if present.
- "goals": array of strings — pick from this list only: ${KNOWN_GOALS.join(", ")}. Only include goals explicitly supported by the document.

Rules:
- Be concise. This fills in an onboarding form, not a report.
- If a field isn't present or you're not confident, omit it entirely.
- Do not hallucinate fields. Only extract what is genuinely in the document.
- voice_examples must be authentic sentences from the document, not paraphrases.

<document>
${rawText.slice(0, MAX_TEXT_CHARS)}
</document>

Return ONLY valid JSON. No markdown code blocks.`.trim()

export async function POST(request: Request) {
  // Auth check — must be logged in to use this endpoint
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large — maximum 10 MB" }, { status: 400 })
    }

    const mimeType = file.type || "application/octet-stream"
    const docType  = SUPPORTED_TYPES[mimeType]
    if (!docType) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF, Word (.docx), or plain-text file." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let message: Awaited<ReturnType<typeof client.messages.create>>

    if (docType === "pdf") {
      // PDF: send directly as a document block — Claude handles extraction natively
      message = await client.messages.create({
        model:      MODELS.docExtraction,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type:   "document",
              source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
            },
            { type: "text", text: EXTRACT_PROMPT("") },
          ],
        }],
      })
    } else {
      // DOCX / TXT: convert to plain text first
      let text = ""
      if (docType === "docx") {
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } else {
        text = buffer.toString("utf-8")
      }

      message = await client.messages.create({
        model:      MODELS.docExtraction,
        max_tokens: 1024,
        messages: [{ role: "user", content: EXTRACT_PROMPT(text) }],
      })
    }

    logAiUsage({ brandId: null, model: MODELS.docExtraction, feature: "brand_doc_extraction", usage: message.usage })

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}"

    // Strip markdown code fences if Claude added them anyway
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim()

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      console.error("[extract-brand-from-document] JSON parse failed:", cleaned)
      return NextResponse.json({ error: "Could not parse brand data from document — try a different file." }, { status: 422 })
    }

    // Sanitise: only return known safe fields
    const result: Record<string, unknown> = {}
    const str = (v: unknown): string | undefined =>
      typeof v === "string" && v.trim() ? v.trim() : undefined

    if (str(extracted.name))                        result.name                        = str(extracted.name)
    if (str(extracted.niche))                       result.niche                       = str(extracted.niche)
    if (str(extracted.tagline))                     result.tagline                     = str(extracted.tagline)
    if (str(extracted.target_audience_description)) result.target_audience_description = str(extracted.target_audience_description)
    if (str(extracted.geographic_location))         result.geographic_location         = str(extracted.geographic_location)
    if (str(extracted.voice_examples))              result.voice_examples              = str(extracted.voice_examples)
    if (str(extracted.website_url)) {
      const url = str(extracted.website_url)!
      if (url.startsWith("https://") || url.startsWith("http://")) result.website_url = url
    }
    if (Array.isArray(extracted.goals)) {
      const validGoals = (extracted.goals as unknown[]).filter(
        (g): g is string => typeof g === "string" && KNOWN_GOALS.includes(g)
      )
      if (validGoals.length > 0) result.goals = validGoals
    }

    return NextResponse.json(result)

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[extract-brand-from-document]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
