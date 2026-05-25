"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { PortalPost } from "./page"

const PLATFORM_EMOJI: Record<string, string> = {
  instagram: "📸",
  linkedin:  "💼",
  facebook:  "👥",
  tiktok:    "🎵",
  x:         "✖",
  threads:   "🧵",
}

interface Brand {
  id:            string
  name:          string | null
  logo_url:      string | null
  primary_color: string | null
}

interface Props {
  brand:         Brand
  posts:         PortalPost[]
  token:         string
  reviewerEmail: string
}

type ApprovalStatus = "approved" | "flagged" | "pending" | null

// Local state tracks optimistic updates per post so the UI responds instantly
type LocalApprovals = Record<string, ApprovalStatus>

export function PortalView({ brand, posts, token }: Props) {
  const [localApprovals, setLocalApprovals] = useState<LocalApprovals>(() => {
    const init: LocalApprovals = {}
    for (const p of posts) {
      init[p.id] = p.client_approval_status ?? null
    }
    return init
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const primaryColor = brand.primary_color ?? "#4f46e5"

  async function handleApproval(postId: string, status: "approved" | "flagged") {
    // Toggle — if clicking the same status, set back to "pending"
    const current = localApprovals[postId]
    const next = current === status ? null : status

    // Optimistic update
    setLocalApprovals((prev) => ({ ...prev, [postId]: next }))
    setSaving(postId)
    setErrors((prev) => ({ ...prev, [postId]: "" }))

    try {
      const res = await fetch("/api/portal/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          postId,
          status: next ?? "pending",
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        // Revert optimistic update on failure
        setLocalApprovals((prev) => ({ ...prev, [postId]: current }))
        setErrors((prev) => ({ ...prev, [postId]: json.error ?? "Failed to save" }))
      }
    } catch {
      setLocalApprovals((prev) => ({ ...prev, [postId]: current }))
      setErrors((prev) => ({ ...prev, [postId]: "Network error — please try again" }))
    } finally {
      setSaving(null)
    }
  }

  const brandName = brand.name ?? "Brand"

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header style={{ borderBottomColor: `${primaryColor}30` }} className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo_url} alt={brandName} className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              {brandName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-zinc-900">{brandName}</p>
            <p className="text-xs text-zinc-500">Content preview — for review only</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Intro card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-1.5">
          <p className="text-sm font-medium text-zinc-900">
            {posts.length > 0
              ? `${posts.length} post${posts.length === 1 ? "" : "s"} scheduled for the next 60 days`
              : "No posts scheduled yet"}
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            You can review each post below and mark it as approved or flag it for changes.
            Your feedback is sent to the team automatically.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">Nothing scheduled yet — check back soon.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const approval = localApprovals[post.id] ?? null
              const isSaving = saving === post.id
              const errorMsg = errors[post.id]
              const scheduledDate = post.scheduled_for
                ? new Date(post.scheduled_for).toLocaleDateString("en-GB", {
                    weekday: "short", day: "numeric", month: "long",
                  })
                : null
              const scheduledTime = post.scheduled_for
                ? new Date(post.scheduled_for).toLocaleTimeString("en-GB", {
                    hour: "2-digit", minute: "2-digit",
                  })
                : null
              const emoji = PLATFORM_EMOJI[post.platform] ?? "📱"

              return (
                <article
                  key={post.id}
                  className={cn(
                    "rounded-xl border bg-white overflow-hidden transition-colors",
                    approval === "approved" && "border-green-200",
                    approval === "flagged"  && "border-amber-200",
                    !approval              && "border-zinc-200",
                  )}
                >
                  {/* Post header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{emoji}</span>
                      <span className="text-xs font-medium text-zinc-700 capitalize">{post.platform}</span>
                      {scheduledDate && (
                        <>
                          <span className="text-zinc-300">·</span>
                          <span className="text-xs text-zinc-500">{scheduledDate} at {scheduledTime}</span>
                        </>
                      )}
                    </div>
                    {/* Approval status badge */}
                    {approval === "approved" && (
                      <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                        ✓ Approved
                      </span>
                    )}
                    {approval === "flagged" && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                        ⚑ Flagged
                      </span>
                    )}
                  </div>

                  {/* Post image */}
                  {(post.generated_image_url || (post.carousel_image_urls?.length ?? 0) > 0) && (
                    <div className="relative bg-zinc-100 aspect-square max-h-80 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.generated_image_url ?? post.carousel_image_urls![0]}
                        alt="Post preview"
                        className="w-full h-full object-cover"
                      />
                      {post.carousel_image_urls && post.carousel_image_urls.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                          +{post.carousel_image_urls.length - 1} slides
                        </div>
                      )}
                    </div>
                  )}

                  {/* Caption */}
                  {post.caption && (
                    <div className="px-4 py-3 border-b border-zinc-100">
                      <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed line-clamp-6">
                        {post.caption}
                      </p>
                    </div>
                  )}

                  {/* Action row */}
                  <div className="px-4 py-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproval(post.id, "approved")}
                      disabled={isSaving}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        approval === "approved"
                          ? "bg-green-50 border-green-300 text-green-700"
                          : "border-zinc-200 text-zinc-600 hover:border-green-300 hover:text-green-700 hover:bg-green-50",
                        isSaving && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <span>👍</span>
                      {approval === "approved" ? "Approved" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproval(post.id, "flagged")}
                      disabled={isSaving}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        approval === "flagged"
                          ? "bg-amber-50 border-amber-300 text-amber-700"
                          : "border-zinc-200 text-zinc-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50",
                        isSaving && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <span>⚑</span>
                      {approval === "flagged" ? "Flagged" : "Flag for changes"}
                    </button>
                    {errorMsg && (
                      <span className="text-xs text-red-600 ml-auto">{errorMsg}</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-zinc-400">Powered by PostFlow · Read-only preview</p>
        </div>
      </main>
    </div>
  )
}
