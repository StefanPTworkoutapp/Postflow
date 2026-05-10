"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ChevronRight, PlusCircle, Sparkles, LayoutGrid, List, Loader2, ArrowRight, Upload, X, Camera, Video, Palette, Trash2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { GenerateCalendarModal } from "./GenerateCalendarModal"

interface SlideContent {
  headline:  string
  body?:     string
  is_hook?:  boolean
  is_cta?:   boolean
}

interface CalendarEntry {
  id: string
  scheduled_date: string
  topic: string | null
  content_pillar: string | null
  platforms: string[] | null
  post_type: string | null
  goal: string | null
  required_media_type:  string | null   // photo | video | carousel | stock | none
  required_media_count: number | null
  media_brief: string | null
  media_urls:  string[] | null
  template_slug: string | null
  slide_content: SlideContent[] | null
  status: string
  posts: Array<{ id: string; caption: string | null; status: string; platform: string }> | null
}

const PLATFORM_EMOJI: Record<string, string> = {
  instagram: "📸",
  linkedin:  "💼",
  facebook:  "👥",
  tiktok:    "🎵",
  x:         "✖",
  threads:   "🧵",
}

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-900/40",
  linkedin:  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/40",
  facebook:  "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/40",
  tiktok:    "bg-zinc-900 text-white border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600",
  x:         "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600",
  threads:   "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600",
}

const STATUS_DOT: Record<string, string> = {
  planned:       "bg-zinc-300",
  media_pending: "bg-amber-400",
  drafting:      "bg-blue-400",
  ready:         "bg-green-400",
  scheduled:     "bg-indigo-400",
  posted:        "bg-indigo-600",
  archived:      "bg-zinc-200",
}

const STATUS_LABEL: Record<string, string> = {
  planned:       "Planned",
  media_pending: "Media needed",
  drafting:      "Drafting",
  ready:         "Ready",
  scheduled:     "Scheduled",
  posted:        "Posted",
  archived:      "Archived",
}

const PILLAR_COLOR: Record<string, string> = {
  education:         "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  motivation:        "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  community:         "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  promotional:       "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  behind_the_scenes: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
  app_teaser:        "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAY_NAMES   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

interface Props {
  initialEntries: CalendarEntry[]
  initialYear:  number
  initialMonth: number
}

export function CalendarView({ initialEntries, initialYear, initialMonth }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [year,  setYear]  = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [entries, setEntries] = useState<CalendarEntry[]>(initialEntries as CalendarEntry[])
  const [loading, setLoading] = useState(false)
  const [dragging,      setDragging]      = useState<string | null>(null)
  const [dragOver,      setDragOver]      = useState<string | null>(null)
  const [showGenerate,  setShowGenerate]  = useState(false)
  const [view,          setView]          = useState<"month" | "list">("month")
  const [creatingPost,    setCreatingPost]    = useState<string | null>(null)  // entryId being created
  const [uploadingFor,    setUploadingFor]    = useState<string | null>(null)  // entryId being uploaded
  const [deletingEntry,   setDeletingEntry]   = useState<string | null>(null)  // entryId being deleted
  const [regeneratingEntry, setRegeneratingEntry] = useState<string | null>(null) // entryId being regenerated
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadEntryId  = useRef<string | null>(null)
  const uploadSlotIndex = useRef<number | null>(null) // null = append mode, number = slot mode

  // Auto-open an entry when arriving from the dashboard via ?open=[entryId]
  useEffect(() => {
    const openId = searchParams.get("open")
    if (!openId) return
    const entry = entries.find(e => e.id === openId)
    if (!entry) return
    // Switch to list view so the entry is visible, then open it
    setView("list")
    handleEntryClick(entry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only

  async function reloadMonth(y = year, m = month) {
    setShowGenerate(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?year=${y}&month=${m}`)
      const json = await res.json()
      setEntries(json.entries ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function navigate(dir: -1 | 1) {
    let m = month + dir, y = year
    if (m < 1)  { m = 12; y-- }
    if (m > 12) { m = 1;  y++ }
    setYear(y); setMonth(m)
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?year=${y}&month=${m}`)
      const json = await res.json()
      setEntries(json.entries ?? [])
    } finally {
      setLoading(false)
    }
  }

  /** Click a calendar entry — navigate to its post or create one first */
  async function handleEntryClick(entry: CalendarEntry) {
    const existingPostId = entry.posts?.[0]?.id
    if (existingPostId) {
      router.push(`/posts/${existingPostId}`)
      return
    }
    setCreatingPost(entry.id)
    try {
      const res  = await fetch(`/api/calendar/${entry.id}/create-post`, { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.postId) { console.error("[create-post]", json.error); return }
      // Optimistically mark entry as drafting
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: "drafting" } : e))
      router.push(`/posts/${json.postId}`)
    } finally {
      setCreatingPost(null)
    }
  }

  /** Trigger file picker for a specific entry, optionally at a slot position */
  function openUpload(entryId: string, slotIndex?: number) {
    uploadEntryId.current   = entryId
    uploadSlotIndex.current = slotIndex ?? null
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file    = e.target.files?.[0]
    const entryId = uploadEntryId.current
    if (!file || !entryId) return
    e.target.value = "" // reset so same file can be re-selected

    // Build a per-slot upload key so only that slot shows a spinner
    const slotKey = uploadSlotIndex.current !== null
      ? `${entryId}:${uploadSlotIndex.current}`
      : entryId
    setUploadingFor(slotKey)

    try {
      const form = new FormData()
      form.append("file", file)
      if (uploadSlotIndex.current !== null) {
        form.append("slotIndex", String(uploadSlotIndex.current))
      }
      const res  = await fetch(`/api/calendar/${entryId}/upload-media`, { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok) { console.error("[upload-media]", json.error); return }
      // Update the entry's media_urls in state
      setEntries(prev => prev.map(e =>
        e.id === entryId
          ? { ...e, media_urls: json.mediaUrls, status: "media_pending" }
          : e
      ))
    } finally {
      setUploadingFor(null)
      uploadSlotIndex.current = null
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!confirm("Delete this calendar entry? This cannot be undone.")) return
    setDeletingEntry(entryId)
    try {
      const res = await fetch(`/api/calendar/${entryId}`, { method: "DELETE" })
      if (!res.ok) { const j = await res.json(); console.error("[delete-entry]", j.error); return }
      setEntries(prev => prev.filter(e => e.id !== entryId))
    } finally {
      setDeletingEntry(null)
    }
  }

  async function handleRegenerateEntry(entryId: string) {
    setRegeneratingEntry(entryId)
    try {
      const res  = await fetch(`/api/calendar/${entryId}/regenerate`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { console.error("[regenerate-entry]", json.error); return }
      setEntries(prev => prev.map(e =>
        e.id === entryId
          ? { ...e, ...json.entry, posts: e.posts }  // keep existing posts ref
          : e
      ))
    } finally {
      setRegeneratingEntry(null)
    }
  }

  async function handleDeleteMedia(entryId: string, url: string) {
    const res  = await fetch(`/api/calendar/${entryId}/upload-media`, {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ url }),
    })
    const json = await res.json()
    if (!res.ok) { console.error("[delete-media]", json.error); return }
    setEntries(prev => prev.map(e =>
      e.id === entryId
        ? { ...e, media_urls: json.mediaUrls, status: json.mediaUrls.length === 0 ? "planned" : "media_pending" }
        : e
    ))
  }

  // ── Calendar grid ────────────────────────────────────────────────────────
  const firstDay    = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startPad    = (firstDay.getDay() + 6) % 7  // 0=Mon … 6=Sun
  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today    = new Date()
  const todayStr = today.toISOString().split("T")[0]

  function dateStr(day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const byDate = entries.reduce<Record<string, CalendarEntry[]>>((acc, e) => {
    const d = e.scheduled_date
    if (!acc[d]) acc[d] = []
    acc[d].push(e)
    return acc
  }, {})

  // ── Drag-and-drop reschedule ─────────────────────────────────────────────
  const handleDragStart = useCallback((id: string) => setDragging(id), [])
  const handleDragEnd   = useCallback(() => { setDragging(null); setDragOver(null) }, [])

  async function handleDrop(date: string) {
    if (!dragging || date === dragOver) return
    setDragOver(null)
    setEntries(prev => prev.map(e => e.id === dragging ? { ...e, scheduled_date: date } : e))
    try {
      await fetch("/api/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dragging, scheduled_date: date }),
      })
    } catch { /* silently ignore; user can reload */ }
    setDragging(null)
  }

  // ── Shared chip renderer ─────────────────────────────────────────────────
  function EntryChip({ entry, compact = false }: { entry: CalendarEntry; compact?: boolean }) {
    const isCreating = creatingPost === entry.id
    return (
      <button
        type="button"
        onClick={() => handleEntryClick(entry)}
        disabled={isCreating}
        draggable={!compact}
        onDragStart={compact ? undefined : (e) => { e.stopPropagation(); handleDragStart(entry.id) }}
        onDragEnd={compact ? undefined : handleDragEnd}
        className={cn(
          "w-full text-left rounded px-1.5 py-0.5 text-xs select-none leading-snug transition-opacity",
          "hover:brightness-95 active:scale-[0.98] cursor-pointer",
          compact ? "cursor-grab active:cursor-grabbing" : "",
          isCreating && "opacity-60 cursor-wait",
          entry.content_pillar
            ? PILLAR_COLOR[entry.content_pillar]
            : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
        )}
        title={entry.topic ?? entry.status}
      >
        <div className="flex items-center gap-1 min-w-0">
          {isCreating
            ? <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" />
            : <span
                className="shrink-0 text-[10px]"
                title={(entry.platforms ?? []).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}
              >
                {(entry.platforms ?? []).slice(0, 2).map(p => PLATFORM_EMOJI[p] ?? "📄").join("")}
              </span>
          }
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[entry.status] ?? "bg-zinc-300")} />
          <span className="truncate">{entry.topic ?? "Post"}</span>
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-semibold w-44 text-center">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Month / List toggle */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setView("month")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "month"
                  ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"
                  : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Month
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border-l transition-colors",
                view === "list"
                  ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"
                  : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowGenerate(true)}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Generate with AI
          </Button>
          <Button asChild size="sm">
            <Link href="/posts/new">
              <PlusCircle className="h-4 w-4 mr-1.5" />
              New post
            </Link>
          </Button>
        </div>
      </div>

      {/* Hidden file input — shared across all list-view upload buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {showGenerate && (
        <GenerateCalendarModal
          year={year}
          month={month}
          onClose={() => setShowGenerate(false)}
          onDone={() => reloadMonth()}
        />
      )}

      {/* ── MONTH VIEW ─────────────────────────────────────────────────────── */}
      {view === "month" && (
        <>
          <div className={cn("grid grid-cols-7 gap-px text-xs font-medium text-[hsl(var(--muted-foreground))] text-center pb-1", loading && "opacity-50")}>
            {DAY_NAMES.map(d => <div key={d}>{d}</div>)}
          </div>

          <div className={cn("grid grid-cols-7 gap-px bg-[hsl(var(--border))] rounded-xl overflow-hidden border", loading && "opacity-50 pointer-events-none")}>
            {cells.map((day, i) => {
              const ds         = day ? dateStr(day) : null
              const isToday    = ds === todayStr
              const dayEntries = ds ? (byDate[ds] ?? []) : []
              const isOver     = ds === dragOver

              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[96px] bg-[hsl(var(--background))] p-1.5 flex flex-col gap-1 transition-colors",
                    !day && "bg-[hsl(var(--muted))]/30",
                    isOver && "bg-indigo-50 dark:bg-indigo-950/30",
                  )}
                  onDragOver={ds ? (e) => { e.preventDefault(); setDragOver(ds) } : undefined}
                  onDrop={ds ? () => handleDrop(ds) : undefined}
                  onDragLeave={() => setDragOver(null)}
                >
                  {day && (
                    <span className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full self-start",
                      isToday
                        ? "bg-indigo-500 text-white"
                        : "text-[hsl(var(--muted-foreground))]"
                    )}>
                      {day}
                    </span>
                  )}

                  {dayEntries.map(entry => (
                    <EntryChip key={entry.id} entry={entry} compact />
                  ))}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-medium">Pillars:</span>
            {Object.entries(PILLAR_COLOR).map(([pillar, cls]) => (
              <span key={pillar} className={cn("px-1.5 py-0.5 rounded text-xs", cls)}>
                {pillar.replace(/_/g, " ")}
              </span>
            ))}
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Click any post to create/open it in the editor. Drag to reschedule.
          </p>
        </>
      )}

      {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
      {view === "list" && (
        <div className={cn("space-y-2", loading && "opacity-50 pointer-events-none")}>
          {entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-6 py-12 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No posts planned for {MONTH_NAMES[month - 1]} {year}.</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Use "Generate with AI" to fill the month.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden divide-y">
              {entries.map(entry => {
                const isCreating   = creatingPost === entry.id
                const existingPost = entry.posts?.[0]
                const platforms    = entry.platforms ?? []
                const mediaUrls    = entry.media_urls ?? [] as string[]
                const mediaType    = entry.required_media_type
                const slideContent = entry.slide_content ?? []
                const isCarousel   = mediaType === "carousel"
                const slideCount   = slideContent.length || entry.required_media_count || 5
                // Count filled slots (non-empty string URLs)
                const uploadedCount = mediaUrls.filter(u => u && u !== "").length

                const MEDIA_CONFIG: Record<string, { icon: React.ElementType; badge: string; brief: string; iconCls: string; label: string }> = {
                  photo:    { icon: Camera,  label: "📷 Personal photo", badge: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300", brief: "bg-orange-50/60 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/40 text-orange-900 dark:text-orange-200", iconCls: "text-orange-400" },
                  video:    { icon: Video,   label: "🎬 Personal video",  badge: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",         brief: "bg-rose-50/60 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/40 text-rose-900 dark:text-rose-200",         iconCls: "text-rose-400" },
                  carousel: { icon: Palette, label: "🖼 Carousel",        badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300",  brief: "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200", iconCls: "text-indigo-400" },
                  stock:    { icon: Palette, label: "🌐 Source online",   badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",             brief: "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300",                     iconCls: "text-zinc-400" },
                }
                const mediaCfg = mediaType ? MEDIA_CONFIG[mediaType] : null

                return (
                  <div key={entry.id} className="px-4 py-3 bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]/20 transition-colors">
                    <div className="flex items-start gap-3">

                      {/* Date column */}
                      <div className="shrink-0 text-center w-10">
                        <p className="text-xs font-semibold text-[hsl(var(--foreground))]">
                          {new Date(entry.scheduled_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric" })}
                        </p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">
                          {new Date(entry.scheduled_date + "T12:00:00").toLocaleDateString("en-GB", { month: "short" })}
                        </p>
                      </div>

                      {/* Main content column */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] leading-snug">
                          {entry.topic ?? <span className="text-[hsl(var(--muted-foreground))] italic">No topic</span>}
                        </p>

                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Platform pills */}
                          {platforms.slice(0, 3).map((p, i) => (
                            <span
                              key={i}
                              className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold",
                                PLATFORM_COLOR[p] ?? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                              )}
                            >
                              <span>{PLATFORM_EMOJI[p] ?? "📄"}</span>
                              <span className="capitalize">{p}</span>
                            </span>
                          ))}
                          {entry.content_pillar && (
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", PILLAR_COLOR[entry.content_pillar] ?? "bg-[hsl(var(--muted))]")}>
                              {entry.content_pillar.replace(/_/g, " ")}
                            </span>
                          )}
                          {entry.post_type && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                              {entry.post_type.replace(/_/g, " ")}
                            </span>
                          )}
                          {mediaCfg && mediaType !== "none" && (
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", mediaCfg.badge)}>
                              {mediaCfg.label}
                              {isCarousel && ` · ${uploadedCount}/${slideCount} photos`}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[entry.status] ?? "bg-zinc-300")} />
                            {STATUS_LABEL[entry.status] ?? entry.status}
                          </span>
                        </div>

                        {/* Media brief — non-carousel */}
                        {entry.media_brief && mediaCfg && mediaType !== "none" && !isCarousel && (
                          <div className={cn("flex items-start gap-1.5 rounded-lg border px-2.5 py-2", mediaCfg.brief)}>
                            <mediaCfg.icon className={cn("h-3 w-3 shrink-0 mt-0.5", mediaCfg.iconCls)} />
                            <p className="text-[11px] leading-relaxed">{entry.media_brief}</p>
                          </div>
                        )}

                        {/* ── CAROUSEL: per-slide slots ── */}
                        {isCarousel && slideContent.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {/* Brief at top for context */}
                            {entry.media_brief && (
                              <div className="flex items-start gap-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 px-2.5 py-2">
                                <Palette className="h-3 w-3 shrink-0 mt-0.5 text-indigo-400" />
                                <p className="text-[11px] leading-relaxed text-indigo-900 dark:text-indigo-200">{entry.media_brief}</p>
                              </div>
                            )}

                            {/* Slide slots */}
                            {slideContent.map((slide, slotIdx) => {
                              const slotUrl      = mediaUrls[slotIdx] ?? ""
                              const hasPhoto     = slotUrl && slotUrl !== ""
                              const isHook       = !!slide.is_hook
                              const isCTA        = !!slide.is_cta
                              const needsPhoto   = isHook || isCTA   // hook + CTA typically get a personal photo
                              const slotKey      = `${entry.id}:${slotIdx}`
                              const isSlotUploading = uploadingFor === slotKey
                              const isVideo      = hasPhoto && /\.(mp4|mov|webm|avi|mkv)$/i.test(slotUrl)

                              const slideTypeLabel =
                                isHook ? "Hook" :
                                isCTA  ? "CTA"  :
                                entry.template_slug === "carousel-myth"
                                  ? (slotIdx % 2 === 1 ? "Myth" : "Reality")
                                  : "Slide"

                              const slideTypeCls =
                                isHook ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" :
                                isCTA  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" :
                                entry.template_slug === "carousel-myth" && slotIdx % 2 === 1
                                       ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"   :
                                entry.template_slug === "carousel-myth"
                                       ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" :
                                         "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"

                              return (
                                <div key={slotIdx} className={cn(
                                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs",
                                  hasPhoto
                                    ? "border-green-200 bg-green-50/40 dark:border-green-800 dark:bg-green-950/10"
                                    : needsPhoto
                                      ? "border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/10"
                                      : "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20"
                                )}>
                                  {/* Slot number */}
                                  <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] w-4 text-center shrink-0">
                                    {slotIdx + 1}
                                  </span>

                                  {/* Type badge */}
                                  <span className={cn("text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded shrink-0", slideTypeCls)}>
                                    {slideTypeLabel}
                                  </span>

                                  {/* Headline */}
                                  <p className="flex-1 truncate text-[11px] text-[hsl(var(--foreground))]">
                                    {slide.headline}
                                  </p>

                                  {/* Photo status + action */}
                                  {hasPhoto ? (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {isVideo ? (
                                        <div className="h-7 w-7 rounded border bg-[hsl(var(--muted))] flex items-center justify-center">
                                          <Video className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                                        </div>
                                      ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={slotUrl} alt="" className="h-7 w-7 rounded border object-cover" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMedia(entry.id, slotUrl)}
                                        className="text-zinc-400 hover:text-red-500 transition-colors"
                                        title="Remove photo"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : needsPhoto ? (
                                    <button
                                      type="button"
                                      onClick={() => openUpload(entry.id, slotIdx)}
                                      disabled={isSlotUploading}
                                      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors shrink-0 disabled:opacity-50"
                                    >
                                      {isSlotUploading
                                        ? <><Loader2 className="h-2.5 w-2.5 animate-spin" />…</>
                                        : <><Camera className="h-2.5 w-2.5" />Add photo</>
                                      }
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 italic">
                                      Text only
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* ── NON-CAROUSEL: flat thumbnail grid ── */}
                        {!isCarousel && mediaUrls.filter(u => u && u !== "").length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {mediaUrls.filter(u => u && u !== "").map((url, i) => {
                              const isVideo = /\.(mp4|mov|webm|avi|mkv)$/i.test(url)
                              return (
                                <div key={i} className="relative group/thumb">
                                  {isVideo ? (
                                    <div className="w-14 h-14 rounded-lg border bg-[hsl(var(--muted))] flex items-center justify-center">
                                      <Video className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                                    </div>
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={url} alt="uploaded media" className="w-14 h-14 rounded-lg border object-cover" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMedia(entry.id, url)}
                                    className="absolute -top-1.5 -right-1.5 hidden group-hover/thumb:flex h-4 w-4 rounded-full bg-red-500 text-white items-center justify-center"
                                    title="Remove"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Right-side actions */}
                      <div className="shrink-0 flex flex-col gap-1.5 items-end">
                        {/* Single upload button — photo/video only (carousel uses per-slot buttons above) */}
                        {(mediaType === "photo" || mediaType === "video") && (
                          <button
                            type="button"
                            onClick={() => openUpload(entry.id)}
                            disabled={uploadingFor === entry.id}
                            className={cn(
                              "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                              uploadedCount > 0
                                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                                : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300",
                              uploadingFor === entry.id && "opacity-60 cursor-wait"
                            )}
                          >
                            {uploadingFor === entry.id
                              ? <><Loader2 className="h-3 w-3 animate-spin" />Uploading…</>
                              : <><Upload className="h-3 w-3" />{uploadedCount > 0 ? "Replace" : "Upload"}</>
                            }
                          </button>
                        )}

                        {/* Open / Create post */}
                        <button
                          type="button"
                          onClick={() => handleEntryClick(entry)}
                          disabled={isCreating}
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                            existingPost
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
                              : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                            isCreating && "opacity-60 cursor-wait"
                          )}
                        >
                          {isCreating
                            ? <><Loader2 className="h-3 w-3 animate-spin" />Creating…</>
                            : existingPost
                              ? <><ArrowRight className="h-3 w-3" />Open post</>
                              : <><ArrowRight className="h-3 w-3" />Create post</>
                          }
                        </button>

                        {/* Regenerate idea */}
                        <button
                          type="button"
                          onClick={() => handleRegenerateEntry(entry.id)}
                          disabled={regeneratingEntry === entry.id}
                          title="Generate a new idea for this slot"
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                            "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                            regeneratingEntry === entry.id && "opacity-60 cursor-wait"
                          )}
                        >
                          {regeneratingEntry === entry.id
                            ? <><Loader2 className="h-3 w-3 animate-spin" />Thinking…</>
                            : <><RefreshCw className="h-3 w-3" />New idea</>
                          }
                        </button>

                        {/* Delete entry */}
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry.id)}
                          disabled={deletingEntry === entry.id}
                          title="Delete this calendar entry"
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                            "border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:border-red-900/40 dark:hover:bg-red-950/30 dark:text-red-500 dark:hover:text-red-400",
                            deletingEntry === entry.id && "opacity-60 cursor-wait"
                          )}
                        >
                          {deletingEntry === entry.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
