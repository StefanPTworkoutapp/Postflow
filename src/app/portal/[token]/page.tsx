/**
 * GET /portal/[token]
 *
 * Public client portal — no login required.
 * Resolves the token → loads the brand's upcoming scheduled posts → renders read-only view.
 * Expired tokens return a friendly error page.
 */

import { createServiceClient } from "@/lib/supabase/service"
import { PortalView } from "./PortalView"

interface Props {
  params: Promise<{ token: string }>
}

export interface PortalPost {
  id:                     string
  caption:                string | null
  platform:               string
  status:                 string
  scheduled_for:          string | null
  generated_image_url:    string | null
  carousel_image_urls:    string[] | null
  template_slug:          string | null
  client_approval_status: "pending" | "approved" | "flagged" | null
  client_reviewed_at:     string | null
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params
  const supabase = createServiceClient()

  // ── Resolve token ──────────────────────────────────────
  const { data: invite } = await supabase
    .from("portal_invites")
    .select("id, brand_id, email, expires_at")
    .eq("token", token)
    .single()

  if (!invite) {
    return <PortalError message="This portal link is invalid or doesn't exist." />
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return <PortalError message="This portal link has expired. Ask the team to send a new one." />
  }

  // ── Update last_viewed_at ──────────────────────────────
  await supabase
    .from("portal_invites")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", invite.id)

  // ── Fetch brand ────────────────────────────────────────
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, logo_url, primary_color")
    .eq("id", invite.brand_id)
    .single()

  if (!brand) {
    return <PortalError message="Brand not found." />
  }

  // ── Fetch upcoming scheduled posts (next 60 days) ──────
  const now = new Date()
  const until = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  const { data: rawPosts } = await supabase
    .from("posts")
    .select(
      "id, caption, platform, status, scheduled_for, generated_image_url, carousel_image_urls, template_slug, client_approval_status, client_reviewed_at",
    )
    .eq("brand_id", invite.brand_id)
    .in("status", ["draft", "scheduled", "ready"])
    .gte("scheduled_for", now.toISOString())
    .lte("scheduled_for", until.toISOString())
    .order("scheduled_for", { ascending: true })

  return (
    <PortalView
      brand={brand}
      posts={(rawPosts ?? []) as PortalPost[]}
      token={token}
      reviewerEmail={invite.email}
    />
  )
}

// ── Error page ─────────────────────────────────────────────

function PortalError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="text-center space-y-3 max-w-sm">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-semibold text-zinc-900">Access unavailable</h1>
        <p className="text-sm text-zinc-500">{message}</p>
      </div>
    </div>
  )
}
