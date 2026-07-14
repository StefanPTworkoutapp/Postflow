"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, X, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, Video, Zap } from "lucide-react"
import { cn, compressionFeedback } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { uploadFile, type UploadStage } from "@/lib/client/upload/upload-manager"

interface UploadFile {
  id:         string
  file:       File
  preview:    string | null
  status:     "pending" | "uploading" | "done" | "error"
  stage?:     UploadStage
  progress?:  number
  error?:     string
  publicUrl?: string
  compressionNote?: string | null
}

// Accept HEIC + increased size limit (compression handles oversized files)
const ACCEPTED = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/mov", "video/avi",
]
const MAX_SIZE = 200 * 1024 * 1024 // 200 MB — compression brings it down before upload

function uid() { return Math.random().toString(36).slice(2) }

const STAGE_LABEL: Record<UploadStage, string> = {
  idle:        "",
  compressing: "Compressing…",
  uploading:   "Uploading…",
  confirming:  "Saving…",
  done:        "Done",
  error:       "Error",
}

export function MediaUploader({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [draggingOver, setDraggingOver] = useState(false)
  const [keepOriginalQuality, setKeepOriginalQuality] = useState(false) // per-session toggle, nothing persisted
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: File[]) {
    const valid = incoming.filter(f => {
      if (!ACCEPTED.includes(f.type)) return false
      if (f.size > MAX_SIZE) return false
      return true
    })
    const newItems: UploadFile[] = valid.map(file => ({
      id: uid(),
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      status: "pending",
    }))
    setFiles(prev => [...prev, ...newItems])
  }

  function removeFile(id: string) {
    setFiles(prev => {
      const f = prev.find(f => f.id === id)
      if (f?.preview) URL.revokeObjectURL(f.preview)
      return prev.filter(f => f.id !== id)
    })
  }

  async function processUpload(item: UploadFile) {
    setFiles(prev => prev.map(f =>
      f.id === item.id ? { ...f, status: "uploading", stage: "idle", progress: 0 } : f
    ))

    try {
      const result = await uploadFile(item.file, {
        keepOriginalQuality,
        onStageChange: (stage) => {
          setFiles(prev => prev.map(f =>
            f.id === item.id ? { ...f, stage } : f
          ))
        },
        onProgress: (pct) => {
          setFiles(prev => prev.map(f =>
            f.id === item.id ? { ...f, progress: pct } : f
          ))
        },
      })
      const note = compressionFeedback(result.originalBytes, result.uploadedBytes)
      setFiles(prev => prev.map(f =>
        f.id === item.id
          ? { ...f, status: "done", stage: "done", progress: 100, publicUrl: result.publicUrl, compressionNote: note }
          : f
      ))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      setFiles(prev => prev.map(f =>
        f.id === item.id ? { ...f, status: "error", stage: "error", error: msg } : f
      ))
    }
  }

  async function uploadAll() {
    const pending = files.filter(f => f.status === "pending" || f.status === "error")
    await Promise.all(pending.map(processUpload))
    onUploadComplete?.()
  }

  const pendingCount   = files.filter(f => f.status === "pending" || f.status === "error").length
  const uploadingCount = files.filter(f => f.status === "uploading").length
  const doneCount      = files.filter(f => f.status === "done").length

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDraggingOver(true) }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDraggingOver(false)
          addFiles(Array.from(e.dataTransfer.files))
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "rounded-xl border-2 border-dashed p-12 flex flex-col items-center gap-3 cursor-pointer transition-colors",
          draggingOver
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
            : "border-[hsl(var(--border))] hover:border-indigo-300 hover:bg-[hsl(var(--muted))]/30"
        )}
      >
        <Upload className={cn("h-8 w-8 transition-colors", draggingOver ? "text-indigo-500" : "text-[hsl(var(--muted-foreground))]")} />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Drop files here or click to browse</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            JPG, PNG, WebP, HEIC, GIF, MP4, MOV · up to 200 MB · compressed automatically
          </p>
        </div>
      </div>

      {/* Compression preference — applies to files added from here on */}
      <label
        className="flex items-center justify-end gap-1.5 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={keepOriginalQuality}
          onChange={(e) => setKeepOriginalQuality(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Keep original quality (skip compression)
      </label>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {doneCount}/{files.length} uploaded
              {uploadingCount > 0 && ` · ${uploadingCount} uploading…`}
            </p>
            {pendingCount > 0 && !uploadingCount && (
              <Button size="sm" onClick={uploadAll}>
                Upload {pendingCount} file{pendingCount > 1 ? "s" : ""}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {files.map((f) => (
              <div key={f.id} className="relative rounded-lg border overflow-hidden bg-[hsl(var(--muted))]/20">
                {/* Thumbnail */}
                <div className="aspect-square flex items-center justify-center bg-[hsl(var(--muted))]/40">
                  {f.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                  ) : (
                    <Video className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  )}

                  {/* Overlay for status */}
                  {f.status === "uploading" && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1.5">
                      {f.stage === "compressing"
                        ? <Zap className="h-6 w-6 text-amber-300 animate-pulse" />
                        : <Loader2 className="h-6 w-6 text-white animate-spin" />
                      }
                      {f.progress !== undefined && (
                        <span className="text-white text-xs font-semibold tabular-nums">
                          {f.progress}%
                        </span>
                      )}
                    </div>
                  )}
                  {f.status === "done" && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <CheckCircle2 className="h-7 w-7 text-green-400" />
                    </div>
                  )}
                  {f.status === "error" && (
                    <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
                      <AlertCircle className="h-7 w-7 text-red-300" />
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="p-2 space-y-1">
                  <div className="flex items-center gap-1">
                    {f.file.type.startsWith("video/")
                      ? <Video className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                      : <ImageIcon className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    }
                    <p className="text-xs truncate font-medium">{f.file.name}</p>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {(f.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>

                  {/* Stage label + progress bar */}
                  {f.status === "uploading" && f.stage && f.stage !== "idle" && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-indigo-500 dark:text-indigo-400">
                        {STAGE_LABEL[f.stage]}
                      </p>
                      {f.progress !== undefined && (
                        <div className="h-0.5 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all duration-200"
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {f.status === "done" && f.compressionNote && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 leading-tight">{f.compressionNote}</p>
                  )}

                  {f.error && <p className="text-xs text-[hsl(var(--destructive))] leading-tight">{f.error}</p>}
                </div>

                {/* Remove button */}
                {f.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(f.id) }}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Uploaded media will be available when generating posts.
          </p>
        </div>
      )}
    </div>
  )
}
