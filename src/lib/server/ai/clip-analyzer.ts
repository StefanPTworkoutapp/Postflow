/**
 * Clip Analyzer — Claude Vision scoring for uploaded video clips.
 *
 * For each clip, Claude Vision analyses a frame extract (first frame + mid frame)
 * and scores the clip on quality, energy, and hook potential.
 *
 * Returns:
 *   quality_score  0–100  — technical quality (lighting, focus, framing)
 *   energy_score   0–100  — visual energy and motion potential
 *   hook_potential 0–100  — how compelling is this as an opening clip
 *   best_order     number — suggested clip order (1 = best opening)
 *   assessment     string — one-line plain English summary
 *
 * Used by:
 *   - clip-forge: to sort clips before Shotstack render
 *   - Reports back to the UI via the clip_forge_clips table
 */

import Anthropic from "@anthropic-ai/sdk"

const claude = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClipAnalysis {
  quality_score:  number  // 0–100
  energy_score:   number  // 0–100
  hook_potential: number  // 0–100
  best_order:     number  // lower = better opening clip
  assessment:     string  // human-readable one-liner
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Analyse a video clip using the first frame (provided as a signed URL or base64 data URI).
 * For performance, we only analyse a single representative frame.
 *
 * @param frameUrl  Public URL or base64 data URI of a representative frame
 * @param clipIndex Zero-based index of the clip in the upload order
 * @param goal      User's stated content goal (e.g. "Grow followers", "Educate")
 */
export async function analyseClip(
  frameUrl:   string,
  clipIndex:  number,
  goal:       string,
): Promise<ClipAnalysis> {
  const prompt = `You are a social media video editor analysing a clip frame for a brand content creator.

Goal of the post: ${goal}
Clip position in upload order: ${clipIndex + 1}

Analyse this frame and return a JSON object with ONLY these keys:
- "quality_score": 0-100 (lighting, focus, framing, no blur/noise)
- "energy_score": 0-100 (visual dynamism, motion, intensity)
- "hook_potential": 0-100 (how compelling as an opening clip — should grab attention immediately)
- "best_order": integer 1-10 (1 = best as opening clip, higher = better later in video)
- "assessment": string (1 sentence, plain English — what makes this clip work or not work)

Consider the goal "${goal}" when scoring hook_potential and best_order.

Respond with ONLY the JSON object, no other text.`

  try {
    const response = await claude.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 256,
      messages: [{
        role:    "user",
        content: [
          {
            type:   "image",
            source: frameUrl.startsWith("data:")
              ? { type: "base64", media_type: "image/jpeg", data: frameUrl.replace(/^data:image\/\w+;base64,/, "") }
              : { type: "url", url: frameUrl },
          },
          { type: "text", text: prompt },
        ],
      }],
    })

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()

    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    const parsed = JSON.parse(json) as Partial<ClipAnalysis>

    return {
      quality_score:  Math.round(Math.min(100, Math.max(0, parsed.quality_score  ?? 70))),
      energy_score:   Math.round(Math.min(100, Math.max(0, parsed.energy_score   ?? 65))),
      hook_potential: Math.round(Math.min(100, Math.max(0, parsed.hook_potential ?? 60))),
      best_order:     Math.max(1, parsed.best_order ?? clipIndex + 1),
      assessment:     parsed.assessment ?? "Clip uploaded successfully.",
    }
  } catch (err) {
    console.error("[clip-analyzer] analysis failed:", err)
    // Return safe defaults so the clip is still usable
    return {
      quality_score:  70,
      energy_score:   65,
      hook_potential: 60,
      best_order:     clipIndex + 1,
      assessment:     "Analysis unavailable — proceeding with upload order.",
    }
  }
}

/**
 * Sort clips by best_order (ascending) and return sorted clip IDs.
 * Used to set the final render order before Shotstack submission.
 */
export function sortClipsByOrder(
  clips: Array<{ id: string; order_index: number; analysis?: ClipAnalysis | null }>
): string[] {
  return [...clips]
    .sort((a, b) => {
      const orderA = a.analysis?.best_order ?? a.order_index + 1
      const orderB = b.analysis?.best_order ?? b.order_index + 1
      return orderA - orderB
    })
    .map(c => c.id)
}
