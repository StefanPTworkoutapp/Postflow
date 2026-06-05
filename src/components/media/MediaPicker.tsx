"use client"

import { useEffect, useState } from "react"
import { Loader2, Check, Video, ImageIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface MediaItem {
  id:         string
  public_url: string | null
  media_type: string | null
  filename:   string
  file_size_mb: number | null
}

interface Props {
  /** IDs already attached to the post */
  selected:    string[]
  onChange:    (ids: string[]) => void
  /** Max files selectable (default: unlimited) */
  max?:        number
  className?:  string
}

export function MediaPicker({ selected, onChange, max, className }: Props) {
  const [items,   setItems]   = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/media")
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return }
        setItems(json.media ?? [])
      })
      .catch(() => setError("Failed to load media"))
      .finally(() => setLoading(false))
  }, [])

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      if (max && selected.length >= max) return
      onChange([...selected, id])
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8 text-[hsl(var(--muted-foreground))]">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading media…
    </div>
  )

  if (error) return (
    <p className="text-sm text-[hsl(var(--destructive))] py-4">{error}</p>
  )

  if (items.length === 0) return (
    <div className="text-center py-8 space-y-2">
      <ImageIcon className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))]/30" />
      <p className="text-sm text-[hsl(var(--muted-foreground))]">No media yet.</p>
      <a href="/schedule?tab=upload" className="text-sm text-indigo-500 hover:underline">Upload files →</a>
    </div>
  )

  return (
    <div className={cn("space-y-2", className)}>
      {max && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {selected.length}/{max} selected
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map(item => {
          const isSelected = selected.includes(item.id)
          const isVideo    = item.media_type === "video"
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={cn(
                "relative rounded-lg overflow-hidden aspect-square border-2 transition-all",
                isSelected
                  ? "border-indigo-500 ring-2 ring-indigo-500/30"
                  : "border-transparent hover:border-indigo-300"
              )}
            >
              {/* Thumbnail */}
              <div className="w-full h-full bg-[hsl(var(--muted))]/40 flex items-center justify-center">
                {item.public_url && !isVideo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.public_url}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Video className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                )}
              </div>

              {/* Selected overlay */}
              {isSelected && (
                <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
              )}

              {/* Video badge */}
              {isVideo && (
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  VID
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Compact inline display of already-attached media (read-only with remove) */
export function AttachedMedia({
  mediaIds,
  onRemove,
}: {
  mediaIds: string[]
  onRemove: (id: string) => void
}) {
  const [items, setItems] = useState<MediaItem[]>([])

  useEffect(() => {
    if (!mediaIds.length) return
    fetch("/api/media")
      .then(r => r.json())
      .then(json => {
        const all: MediaItem[] = json.media ?? []
        setItems(all.filter(m => mediaIds.includes(m.id)))
      })
  }, [mediaIds])

  if (!mediaIds.length) return null

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <div key={item.id} className="relative w-16 h-16 rounded-lg overflow-hidden border">
          {item.public_url && item.media_type !== "video" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.public_url} alt={item.filename} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[hsl(var(--muted))]/40 flex items-center justify-center">
              <Video className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
