/**
 * whisper-captions.ts
 *
 * Transcribes a video/audio file using the OpenAI Whisper API and returns
 * timestamped caption phrases ready for Shotstack layer injection.
 *
 * Called in the render route before assembleBrandedRender() so that
 * phrase-by-phrase captions can be passed as ClipInput.captionText overlays.
 *
 * Requires:
 *   POSTFLOW_ANTHROPIC_KEY is already set — but Whisper uses OPENAI_API_KEY.
 *   If OPENAI_API_KEY is not set, transcription is skipped gracefully (returns []).
 *
 * Usage:
 *   const phrases = await transcribeClips(clipUrls)
 *   // phrases[i].text is used as captionText for clip i
 */

export interface CaptionPhrase {
  text:  string   // the transcribed phrase
  start: number   // seconds from clip start
  end:   number
}

export interface ClipTranscript {
  clipIndex: number
  phrases:   CaptionPhrase[]
  /** Single-string summary of the clip's spoken content — used as captionText overlay */
  summary:   string
}

// ── Main entry ────────────────────────────────────────────────────────────────

/**
 * Transcribe an array of clip public URLs in parallel via Whisper.
 * Returns one ClipTranscript per clip (same index order).
 * If transcription fails for a clip, returns empty phrases for that clip.
 */
export async function transcribeClips(
  clipUrls: string[],
): Promise<ClipTranscript[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn("[whisper-captions] OPENAI_API_KEY not set — skipping transcription")
    return clipUrls.map((_, i) => ({ clipIndex: i, phrases: [], summary: "" }))
  }

  const results = await Promise.allSettled(
    clipUrls.map((url, i) => transcribeOne(url, i, apiKey))
  )

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { clipIndex: i, phrases: [], summary: "" }
  )
}

// ── Per-clip transcription ────────────────────────────────────────────────────

async function transcribeOne(
  clipUrl:   string,
  clipIndex: number,
  apiKey:    string,
): Promise<ClipTranscript> {
  // Fetch the clip from storage
  const fileRes = await fetch(clipUrl)
  if (!fileRes.ok) throw new Error(`Failed to fetch clip: ${fileRes.status}`)

  const blob     = await fileRes.blob()
  const filename = clipUrl.split("/").pop() ?? `clip_${clipIndex}.mp4`

  // Build multipart form for Whisper API
  const form = new FormData()
  form.append("file",             new File([blob], filename, { type: blob.type || "video/mp4" }))
  form.append("model",            "whisper-1")
  form.append("response_format",  "verbose_json")  // includes word/segment timestamps
  form.append("timestamp_granularities[]", "segment")

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body:    form,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Whisper API error ${res.status}: ${err}`)
  }

  const data = await res.json() as WhisperVerboseResponse

  // Map Whisper segments to CaptionPhrases
  const phrases: CaptionPhrase[] = (data.segments ?? []).map(seg => ({
    text:  seg.text.trim(),
    start: seg.start,
    end:   seg.end,
  }))

  // Summary = full transcript text truncated to ~80 chars for the overlay label
  const full    = data.text?.trim() ?? ""
  const summary = full.length > 80 ? full.slice(0, 77) + "…" : full

  return { clipIndex, phrases, summary }
}

// ── Whisper API types ─────────────────────────────────────────────────────────

interface WhisperVerboseResponse {
  text:      string
  segments?: Array<{
    id:    number
    start: number
    end:   number
    text:  string
  }>
}
