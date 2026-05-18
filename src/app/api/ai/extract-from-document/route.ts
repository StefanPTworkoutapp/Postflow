import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import mammoth from "mammoth"
import { MODELS } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_TEXT_CHARS = 60_000          // trim very long docs before sending

const SUPPORTED_TYPES: Record<string, string> = {
  "application/pdf":                                                       "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword":                                                    "docx",
  "text/plain":                                                            "txt",
  "text/markdown":                                                         "txt",
}

/** Prompt used for all document types after text is available */
const EXTRACT_PROMPT = (rawText: string) => `
This document contains brand writing guidelines, tone-of-voice notes, or example copy.
Your job is to extract the parts that best demonstrate HOW this brand writes — not what it sells.

From the text below, extract 5–10 representative example sentences, phrases, or short passages that clearly show:
- Writing style (sentence length, rhythm, formality level)
- Vocabulary and word choices
- Personality and tone markers
- Any signature phrases, expressions, or CTAs

Format your output as plain text examples separated by:

---

Omit: company history, legal text, statistics, product specs, navigation labels, or anything that isn't authentic writing in the brand's voice.

If the document already contains finished social media captions or blog excerpts, include those as-is — they are perfect examples.

<document>
${rawText.slice(0, MAX_TEXT_CHARS)}
</document>

Return ONLY the extracted examples, nothing else.`.trim()

/**
 * POST /api/ai/extract-from-document
 * Accepts a multipart/form-data upload with a single "file" field.
 * Supports PDF (native Claude document API), DOCX (mammoth), and TXT/MD.
 * Returns { text: string } — same shape as extract-from-images, drops into tone_examples.
 */
export async function POST(request: Request) {
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
    const docType = SUPPORTED_TYPES[mimeType]

    if (!docType) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF, Word (.docx), or plain-text file." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let text = ""

    // ── PDF: send directly to Claude as a document block ──────────────────
    if (docType === "pdf") {
      const base64 = buffer.toString("base64")

      const message = await client.messages.create({
        model:      MODELS.docExtraction,
        max_tokens: 2048,
        messages: [{
          role:    "user",
          content: [
            {
              type:   "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            } as Anthropic.DocumentBlockParam,
            {
              type: "text",
              text: `This document contains brand writing guidelines, tone-of-voice notes, or example copy.
Extract 5–10 representative examples that clearly show HOW this brand writes: sentence style, vocabulary, tone, signature phrases, CTAs.

Separate each example with:

---

Return ONLY the extracted examples, nothing else. Omit legal text, statistics, and navigation labels.`,
            },
          ],
        }],
      })

      logAiUsage({ brandId: null, model: MODELS.docExtraction, feature: "doc_extraction", usage: message.usage })
      text = message.content[0].type === "text" ? message.content[0].text.trim() : ""
    }

    // ── DOCX: extract plain text with mammoth, then pass to Claude ─────────
    if (docType === "docx") {
      const result = await mammoth.extractRawText({ buffer })
      const rawText = result.value.trim()

      if (!rawText) {
        return NextResponse.json({ error: "Could not read text from the Word document." }, { status: 422 })
      }

      const message = await client.messages.create({
        model:      MODELS.docExtraction,
        max_tokens: 2048,
        messages: [{
          role:    "user",
          content: EXTRACT_PROMPT(rawText),
        }],
      })

      logAiUsage({ brandId: null, model: MODELS.docExtraction, feature: "doc_extraction", usage: message.usage })
      text = message.content[0].type === "text" ? message.content[0].text.trim() : ""
    }

    // ── TXT / Markdown ─────────────────────────────────────────────────────
    if (docType === "txt") {
      const rawText = buffer.toString("utf-8").trim()

      if (!rawText) {
        return NextResponse.json({ error: "The file appears to be empty." }, { status: 422 })
      }

      const message = await client.messages.create({
        model:      MODELS.docExtraction,
        max_tokens: 2048,
        messages: [{
          role:    "user",
          content: EXTRACT_PROMPT(rawText),
        }],
      })

      logAiUsage({ brandId: null, model: MODELS.docExtraction, feature: "doc_extraction", usage: message.usage })
      text = message.content[0].type === "text" ? message.content[0].text.trim() : ""
    }

    if (!text) {
      return NextResponse.json({ error: "Could not extract voice examples from the document." }, { status: 500 })
    }

    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[extract-from-document]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
