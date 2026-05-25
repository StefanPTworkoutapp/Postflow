/**
 * POST /api/portal/approve
 *
 * Called from the public client portal when a reviewer clicks thumbs up / down.
 * No authentication — validated by the portal token in the request body.
 *
 * Body: { token: string, postId: string, status: "approved" | "flagged" | "pending" }
 * Response: { ok: true }
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const schema = z.object({
  token:  z.string().min(60),
  postId: z.string().uuid(),
  // "pending" = reviewer toggled back to no opinion
  status: z.enum(["approved", "flagged", "pending"]),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const { token, postId, status } = parsed.data

  const supabase = createServiceClient()

  // 1. Validate the token and get the associated brand
  const { data: invite, error: inviteError } = await supabase
    .from("portal_invites")
    .select("id, brand_id, email, expires_at")
    .eq("token", token)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invalid or expired portal link" }, { status: 403 })
  }

  // Check expiry
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This portal link has expired" }, { status: 403 })
  }

  // 2. Verify the post belongs to the invite's brand
  const { data: post } = await supabase
    .from("posts")
    .select("id, brand_id, status")
    .eq("id", postId)
    .single()

  if (!post || post.brand_id !== invite.brand_id) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  // Only allow reviewing posts that are not already published
  if (post.status === "posted") {
    return NextResponse.json({ error: "This post has already been published" }, { status: 409 })
  }

  // 3. Update the post approval status
  const approvalStatus = status === "pending" ? null : status
  const { error: updateError } = await supabase
    .from("posts")
    .update({
      client_approval_status: approvalStatus,
      client_reviewed_at:     approvalStatus ? new Date().toISOString() : null,
      client_reviewer_email:  approvalStatus ? invite.email : null,
      updated_at:             new Date().toISOString(),
    })
    .eq("id", postId)

  if (updateError) {
    console.error("portal approve update error:", updateError.message)
    return NextResponse.json({ error: "Failed to save approval" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
