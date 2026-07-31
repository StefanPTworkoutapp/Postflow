"use client"

/**
 * MediaSelector — unified "Library | Upload new" component.
 *
 * Replaces standalone MediaPicker / upload dropzones across all upload
 * surfaces. Both tabs are always available so the user can pick an existing
 * file or upload a new one without navigating away.
 *
 * After a successful upload the component switches back to Library, refreshes
 * the grid, and auto-selects the newly uploaded media ID.
 *
 * Props:
 *   selected    — currently selected media IDs (controlled)
 *   onChange    — called with updated ID array
 *   max         — max selectable count (default unlimited)
 *   type        — restrict library + upload to "image" | "video" (default all)
 *   className   — wrapper class
 */

import { useCallback, useRef, useState } from "react"
import { Upload, Library, X, CheckCircle2, AlertCircle, Loader2, Video, ImageIcon, Zap } from "lucide-react"
import { cn, compressionFeedback } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MediaPicker } from "./MediaPicker"
import { uploadFile, type UploadStage } from "@/lib/client/upload/upload-manager"

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "library" | "upload"

interface UploadItem {
  id:                  string
  file:                File
  preview:             string | null
  status:              "pending" | "uploading" | "done" | "error"
  stage?:              UploadStage
  progress?:           number
  error?:              string
  mediaId?:            string
  compressionNote?:    string | null
  compressionWarning?: string
  deduplicated?:       boolean
}

interface MediaSelectorProps {
  selected:   string[]
  onChange:   (ids: string[]) => void
  max?:       number
  type?:      "image" | "video"
  className?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_ALL   = ["image/jpeg","image/png","image/webp","image/gif","image/heic","image/heif","video/mp4","video/quicktime","video/mov","video/avi"]
const ACCEPTED_IMAGE = ["image/jpeg","image/png","image/webp","image/gif","image/heic","image/heif"]
const ACCEPTED_VIDEO = ["video/mp4","video/quicktime","video/mov","video/avi"]
const MAX_SIZE = 200 * 1024 * 1024

const STAGE_LABEL: Record<UploadStage, string> = {
  idle:        "",
  compressing: "Compressing…",
  uploading:   "Uploading…",
  confirming:  "Saving…",
  done:        "Done",
  error:       "Error",
}

function uid() { return Math.random().toString(36).slice(2) }

// ── Component ─────────────────────────────────────────────────────────────────

export function MediaSelector({ selected, onChange, max, type, className }: MediaSelectorProps) {
  const [tab,           setTab]           = useState<Tab>("library")
  const [files,         setFiles]         = useState<UploadItem[]>([])
  const [draggingOver,  setDraggingOver]  = useState(false)
  const [keepOriginal,  setKeepOriginal]  = useState(false)
  const [refreshKey,    setRefreshKey]    = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const accepted = type === "image" ? ACCEPTED_IMAGE : type === "video" ? ACCEPTED_VIDEO : ACCEPTED_ALL
  const acceptStr = accepted.join(",")

  // ── Upload logic ───────────────────────────────────────────────────────────

  function addFiles(incoming: File[]) {
    const newItems: UploadItem[] = incoming.map(file => {
      if (!accepted.includes(file.type)) {
        const ext = file.name.split(".").pop()?.toUpperCase() ?? file.type
        return {
          id: uid(), file, preview: null, status: "error" as const,
          error: `${ext} files aren't supported here. ${
            type === "image" ? "Upload images (JPG, PNG, WebP, GIF, HEIC)." :
            type === "video" ? "Upload videos (MP4, MOV)." :
            "Upload images or videos (JPG, PNG, MP4, MOV, etc.)."
          }`,
        }
      }
      if (file.size > MAX_SIZE) {
        return {
          id: uid(), file, preview: null, status: "error" as const,
          error: `File is ${(file.size / 1024 / 1024).toFixed(0)} MB — too large. Videos are compressed automatically; try exporting at a lower resolution.`,
        }
      }
      return {
        id:      uid(),
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        status:  "pending" as const,
      }
    })
    setFiles(prev => [...prev, ...newItems])
  }

  function removeFile(id: string) {
    setFiles(prev => {
      const f = prev.find(f => f.id === id)
      if (f?.preview) URL.revokeObjectURL(f.preview)
      return prev.filter(f => f.id !== id)
    })
  }

  async function processUpload(item: UploadItem) {
    setFiles(prev => prev.map(f =>
      f.id === item.id ? { ...f, status: "uploading", stage: "idle", progress: 0 } : f
    ))

    try {
      const result = await uploadFile(item.file, {
        keepOriginalQuality: keepOriginal,
        onStageChange: stage => setFiles(prev => prev.map(f => f.id === item.id ? { ...f, stage } : f)),
        onProgress:    pct   => setFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: pct } : f)),
      })

      const note = compressionFeedback(result.originalBytes, result.uploadedBytes)
      setFiles(prev => prev.map(f => f.id === item.id ? {
        ...f,
        status:             "done",
        stage:              "done",
        progress:           100,
        mediaId:            result.mediaId,
        compressionNote:    note,
        compressionWarning: result.compressionWarning,
        deduplicated:       result.deduplicated,
      } : f))

      // Auto-select the new media ID (respecting max)
      if (result.mediaId) {
        onChange(
          max && selected.length >= max
            ? [...selected.slice(1), result.mediaId]  // evict oldest if at max
            : [...selected, result.mediaId]
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "error", stage: "error", error: msg } : f))
    }
  }

  async function uploadAll() {
    const pending = files.filter(f => f.status === "pending")
    await Promise.all(pending.map(processUpload))
    // Refresh library grid and switch to it so user sees the new file
    setRefreshKey(k => k + 1)
    setTab("library")
  }

  const pendingCount   = files.filter(f => f.status === "pending").length
  const uploadingCount = files.filter(f => f.status === "uploading").length
  const doneCount      = files.filter(f => f.status === "done").length

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={cn("space-y-3", className)}>
      {/* Tab strip */}
      <div className="flex rounded-lg border overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => setTab("library")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors",
            tab === "library"
              ? "bg-indigo-500 text-white"
              : "bg-[hsl(var(--muted))]/30 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/60"
          )}
        >
          <Library className="h-3.5 w-3.5" /> Library
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors border-l border-[hsl(var(--border))]",
            tab === "upload"
              ? "bg-indigo-500 text-white"
              : "bg-[hsl(var(--muted))]/30 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/60"
          )}
        >
          <Upload className="h-3.5 w-3.5" /> Upload new
        </button>
      </div>

      {/* Library tab */}
      {tab === "library" && (
        <MediaPicker
          selected={selected}
          onChange={onChange}
          max={max}
          type={type}
          refreshKey={refreshKey}
        />
      )}

      {/* Upload tab */}
      {tab === "upload" && (
        <div className="space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setDraggingOver(true) }}
            onDragLeave={() => setDraggingOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-2 cursor-pointer transition-colors",
              draggingOver
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                : "border-[hsl(var(--border))] hover:border-indigo-300 hover:bg-[hsl(var(--muted))]/20"
            )}
          >
            <Upload className={cn("h-7 w-7 transition-colors", draggingOver ? "text-indigo-500" : "text-[hsl(var(--muted-foreground))]")} />
            <div className="text-center space-y-0.5">
              <p className="text-sm font-medium">Drop files here or click to browse</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {type === "image" ? "JPG, PNG, WebP, HEIC, GIF · up to 50 MB" :
                 type === "video" ? "MP4, MOV · up to 200 MB · compressed automatically" :
                 "Images & videos · up to 200 MB · compressed automatically"}
              </p>
            </div>
          </div>

          <label className="flex items-center justify-end gap-1.5 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepOriginal}
              onChange={e => setKeepOriginal(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Keep original quality (skip compression)
          </label>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={acceptStr}
            className="hidden"
            onChange={e => addFiles(Array.from(e.target.files ?? []))}
          />

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {doneCount}/{files.length} uploaded
                  {uploadingCount > 0 && ` · ${uploadingCount} uploading…`}
                </p>
                {pendingCount > 0 && !uploadingCount && (
                  <Button size="sm" onClick={uploadAll}>
                    Upload {pendingCount} file{pendingCount > 1 ? "s" : ""}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {files.map(f => (
                  <div key={f.id} className="relative rounded-lg border overflow-hidden bg-[hsl(var(--muted))]/20">
                    {/* Thumbnail */}
                    <div className="aspect-square flex items-center justify-center bg-[hsl(var(--muted))]/40">
                      {f.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                      ) : (
                        <Video className="h-7 w-7 text-[hsl(var(--muted-foreground))]" />
                      )}

                      {f.status === "uploading" && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
                          {f.stage === "compressing"
                            ? <Zap className="h-5 w-5 text-amber-300 animate-pulse" />
                            : <Loader2 className="h-5 w-5 text-white animate-spin" />
                          }
                          {f.progress !== undefined && (
                            <span className="text-white text-xs font-semibold">{f.progress}%</span>
                          )}
                        </div>
                      )}
                      {f.status === "done" && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-green-400" />
                        </div>
                      )}
                      {f.status === "error" && (
                        <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center">
                          <AlertCircle className="h-6 w-6 text-red-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-1.5 space-y-0.5">
                      <div className="flex items-center gap-1">
                        {f.file.type.startsWith("video/")
                          ? <Video className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          : <ImageIcon className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                        }
                        <p className="text-xs truncate font-medium">{f.file.name}</p>
                      </div>

                      {f.status === "uploading" && f.stage && f.stage !== "idle" && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-indigo-500">{STAGE_LABEL[f.stage]}</p>
                          {f.progress !== undefined && (
                            <div className="h-0.5 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${f.progress}%` }} />
                            </div>
                          )}
                        </div>
                      )}

                      {f.status === "done" && f.deduplicated && (
                        <p className="text-[10px] text-sky-500 leading-tight">Already in library — reused</p>
                      )}
                      {f.status === "done" && f.compressionNote && !f.deduplicated && (
                        <p className="text-[10px] text-green-600 dark:text-green-400 leading-tight">{f.compressionNote}</p>
                      )}
                      {f.compressionWarning && (
                        <p className="text-[10px] text-amber-500 leading-tight">⚠ {f.compressionWarning}</p>
                      )}
                      {f.error && (
                        <p className="text-[10px] text-[hsl(var(--destructive))] leading-tight">{f.error}</p>
                      )}
                    </div>

                    {f.status !== "uploading" && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); removeFile(f.id) }}
                        className="absolute top-1 right-1 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
