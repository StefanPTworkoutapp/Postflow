import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

const VALID_TYPES = ["great", "too_formal", "too_casual", "wrong_voice", "cta_weak"] as const
type FeedbackType = typeof VALID_TYPES[number]

/**
 * POST /api/posts/[id]/feedback
 * Records tone feedback for a post. Used by the learning loop later.
 * Body: { feedback_type: FeedbackType; comment?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  const body = await request.json() as { feedback_type?: string; comment?: string }
  if (!body.feedback_type || !VALID_TYPES.includes(body.feedback_type as FeedbackType)) {
    return NextResponse.json({ error: "Invalid feedback_type" }, { status: 400 })
  }

  const { error } = await supabase.from("tone_feedback").insert({
    brand_id:      brand.id,
    post_id:       postId,
    feedback_type: body.feedback_type,
    user_comment:  body.comment?.trim() || null,
  })

  if (error) {
    console.error("[feedback] insert error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
