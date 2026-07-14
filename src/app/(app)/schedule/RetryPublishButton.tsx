"use client"

/**
 * RetryPublishButton — re-fires the direct-publish schedule flow for a post
 * whose status is "failed" (Inngest retries exhausted, publish_error set by
 * publishScheduledPost's onFailure handler).
 *
 * Reuses POST /api/posts/[id]/schedule with a near-future time, same as the
 * Retry action on the post detail page (PostEditor.handleRetry).
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface Props {
  postId: string
}

export function RetryPublishButton({ postId }: Props) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleRetry(e: React.MouseEvent) {
    // Card this button sits in is wrapped in a Link elsewhere on the page —
    // stop the click from bubbling into a navigation.
    e.preventDefault()
    e.stopPropagation()

    setRetrying(true)
    setError(null)
    try {
      const scheduledAt = new Date(Date.now() + 2 * 60 * 1000).toISOString()
      const res = await fetch(`/api/posts/${postId}/schedule`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scheduledAt }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Retry failed")
        return
      }
      router.refresh()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
      >
        {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔁"}
        {retrying ? "Retrying…" : "Retry"}
      </button>
      {error && <span className="text-[10px] text-red-600 dark:text-red-400 max-w-[140px] text-right">{error}</span>}
    </div>
  )
}
