"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { X, Smile } from "lucide-react"
import { cn } from "@/lib/utils"

// Lazy-load the heavy picker bundle — only pulled in when the component mounts
const Picker = dynamic(
  () => import("@emoji-mart/react"),
  { ssr: false, loading: () => null }
)

interface Props {
  /** Space-separated emoji string, e.g. "💪 ✅ 🔥" */
  value:     string
  onChange:  (value: string) => void
  className?: string
}

export function EmojiInput({ value, onChange, className }: Props) {
  const [open, setOpen]   = useState(false)
  const wrapRef           = useRef<HTMLDivElement>(null)

  // Parse stored string into array of individual emojis
  const emojis = value
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean)

  function add(emoji: string) {
    if (emojis.includes(emoji)) return   // no duplicates
    onChange([...emojis, emoji].join(" "))
  }

  function remove(emoji: string) {
    onChange(emojis.filter(e => e !== emoji).join(" "))
  }

  // Close picker on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {/* Selected chips + add button */}
      <div className="flex flex-wrap items-center gap-2 min-h-[38px] rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-1.5">
        {emojis.map(emoji => (
          <span
            key={emoji}
            className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full px-2 py-0.5 text-base leading-none"
          >
            {emoji}
            <button
              type="button"
              onClick={() => remove(emoji)}
              className="text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors"
              aria-label={`Remove ${emoji}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={cn(
            "flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors",
            open && "text-indigo-500"
          )}
        >
          <Smile className="h-4 w-4" />
          {emojis.length === 0 ? "Pick emojis" : "Add more"}
        </button>
      </div>

      {/* Floating picker */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 shadow-xl rounded-xl overflow-hidden">
          <Picker
            data={async () => {
              const { default: data } = await import("@emoji-mart/data")
              return data
            }}
            onEmojiSelect={(e: { native: string }) => {
              add(e.native)
              // keep picker open so they can pick multiple
            }}
            theme="light"
            previewPosition="none"
            skinTonePosition="none"
            set="native"
          />
        </div>
      )}
    </div>
  )
}
