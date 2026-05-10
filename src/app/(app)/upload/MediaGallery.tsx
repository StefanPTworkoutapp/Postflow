"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Image as ImageIcon, Video, Trash2, Loader2, Star, Tag,
  CalendarDays, ChevronDown, ChevronUp, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MediaItem {
  id:               string
  public_url:       string | null
  media_type:       string | null
  mime_type:        string | null
  filename:         string
  file_size_mb:     number | null
  ai_tags:          string[] | null
  ai_description:   string | null
  ai_quality_score: number | null
  used_in_post_id:  string | null
  created_at:       string
}

interface CalendarMatch {
  id:                  string
  scheduled_date:      string
  topic:               string
  platforms:           string[]
  post_type:           string | null
  content_pillar:      string | null
  required_media_type: string | null
}

function QualityDots({ score }: { score: number }) {
  const filled = Math.round(score / 2) // 0–5 dots from 0–10 score
  return (
    <div className="flex gap-0.5" title={`Quality: ${score.toFixed(1)}/10`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < filled
              ? score >= 7 ? "bg-green-500" : score >= 5 ? "bg-amber-400" : "bg-red-400"
              : "bg-[hsl(var(--muted))]"
          )}
        />
      ))}
    </div>
  )
}

function MediaCard({
  item,
  onDelete,
}: {
  item:     MediaItem
  onDelete: (id: string) => void
}) {
  const [deleting,  setDeleting]  = useState(false)
  const [showMatch, setShowMatch] = useState(false)
  const [matches,   setMatches]   = useState<CalendarMatch[] | null>(null)
  const [loadingMatch, setLoadingMatch] = useState(false)

  async function handleDelete() {
    if (!confirm("Remove this file from your library?")) return
    setDeleting(true)
    await fetch(`/api/media/${item.id}`, { method: "DELETE" })
    onDelete(item.id)
  }

  async function toggleMatches() {
    if (showMatch) { setShowMatch(false); return }
    setShowMatch(true)
    if (matches !== null) return
    setLoadingMatch(true)
    try {
      const res  = await fetch(`/api/media/${item.id}/matches`)
      const data = await res.json()
      setMatches(data.matches ?? [])
    } finally {
      setLoadingMatch(false)
    }
  }

  const isVideo = item.media_type === "video"
  const date    = new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

  return (
    <div className="rounded-xl border overflow-hidden bg-[hsl(var(--card))] flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-[hsl(var(--muted))]/40 overflow-hidden">
        {item.public_url && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.public_url}
            alt={item.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo
              ? <Video    className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
              : <ImageIcon className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
            }
          </div>
        )}

        {/* Quality score overlay */}
        {item.ai_quality_score !== null && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {item.ai_quality_score.toFixed(1)}
          </div>
        )}

        {/* Delete */}
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600/80 transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        </button>

        {/* Used badge */}
        {item.used_in_post_id && (
          <div className="absolute bottom-2 left-2 rounded-full bg-indigo-600/80 px-2 py-0.5 text-xs text-white">
            Used
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-2 flex-1 flex flex-col">
        {/* Filename + date */}
        <div>
          <p className="text-xs font-medium truncate">{item.filename}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {item.file_size_mb ? `${item.file_size_mb.toFixed(1)} MB · ` : ""}{date}
          </p>
        </div>

        {/* Quality dots (only when tagged) */}
        {item.ai_quality_score !== null && (
          <QualityDots score={item.ai_quality_score} />
        )}

        {/* AI description */}
        {item.ai_description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed line-clamp-2">
            {item.ai_description}
          </p>
        )}

        {/* AI tags */}
        {item.ai_tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {item.ai_tags.slice(0, 5).map(tag => (
              <span
                key={tag}
                className="flex items-center gap-0.5 text-xs rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[hsl(var(--muted-foreground))]"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[hsl(var(--muted-foreground))] italic">
            {isVideo ? "Video — not AI-tagged" : "Tagging…"}
          </p>
        )}

        {/* Calendar match button */}
        <div className="mt-auto pt-1">
          <button
            type="button"
            onClick={toggleMatches}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Assign to post
            {showMatch ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showMatch && (
            <div className="mt-2 space-y-1.5">
              {loadingMatch ? (
                <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                  <Loader2 className="h-3 w-3 animate-spin" /> Finding matches…
                </div>
              ) : matches?.length ? (
                matches.map(m => (
                  <a
                    key={m.id}
                    href={`/calendar?open=${m.id}`}
                    className="block rounded-lg border px-2.5 py-1.5 hover:bg-[hsl(var(--muted))]/50 transition-colors"
                  >
                    <p className="text-xs font-medium truncate">{m.topic}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(m.scheduled_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" · "}
                      {(m.platforms as string[])?.[0] ?? ""}
                      {m.required_media_type ? ` · ${m.required_media_type}` : ""}
                    </p>
                  </a>
                ))
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  No upcoming entries needing this media type.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function MediaGallery({ refreshKey }: { refreshKey: number }) {
  const [items,   setItems]   = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<"all" | "image" | "video">("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/media")
      const data = await res.json()
      setItems(data.media ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = items.filter(i =>
    filter === "all" ? true : i.media_type === filter
  )

  const imageCount = items.filter(i => i.media_type === "image").length
  const videoCount = items.filter(i => i.media_type === "video").length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center space-y-1.5">
        <ImageIcon className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No media uploaded yet.</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Drop files above to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
        {([
          { key: "all",   label: `All (${items.length})`   },
          { key: "image", label: `Photos (${imageCount})`  },
          { key: "video", label: `Videos (${videoCount})`  },
        ] as const).map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={cn(
              "px-3 py-1 text-xs rounded-full border transition-colors",
              filter === tab.key
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map(item => (
          <MediaCard key={item.id} item={item} onDelete={handleDelete} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-4">
          No {filter} files uploaded yet.
        </p>
      )}
    </div>
  )
}
