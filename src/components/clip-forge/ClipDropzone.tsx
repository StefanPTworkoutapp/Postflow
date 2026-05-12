/**
 * ClipDropzone — drag-and-drop video clip uploader for clip-forge.
 *
 * - Accepts multiple .mp4 / .mov / .webm files (max 10 clips, 500 MB each)
 * - Uploads each clip to postflow-clips via /api/clip-forge/upload-url
 * - Extracts a frame screenshot for Claude Vision analysis (canvas approach)
 * - Shows upload progress per clip
 * - Calls onClipsReady with all clip data once all uploads complete
 */

"use client"

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react"
import { Upload, X, CheckCircle2, Film, Loader2 } from "lucide-react"
import { cn }    from "@/lib/utils"
import { Button } from "@/components/ui/button"

const MAX_CLIPS    = 10
const MAX_BYTES    = 500 * 1024 * 1024  // 500 MB
const ACCEPTED     = ["video/mp4", "video/quicktime", "video/webm"]

export interface UploadedClip {
  path:          string
  duration:      number
  fileName:      string
  frameDataUri?: string
}

interface ClipDropzoneProps {
  onClipsReady: (clips: UploadedClip[]) => void
  className?:   string
}

interface ClipItem {
  id:       string
  file:     File
  status:   "pending" | "uploading" | "done" | "error"
  progress: number
  path?:    string
  duration?: number
  frameDataUri?: string
  error?:   string
}

/** Extract first-frame screenshot from a video file via canvas. */
async function extractFrame(file: File): Promise<string | undefined> {
  return new Promise(resolve => {
    try {
      const url    = URL.createObjectURL(file)
      const video  = document.createElement("video")
      video.preload  = "metadata"
      video.muted    = true
      video.currentTime = 0.5

      video.onloadeddata = () => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width  = Math.min(video.videoWidth,  640)
          canvas.height = Math.min(video.videoHeight, 360)
          const ctx = canvas.getContext("2d")
          if (!ctx) { URL.revokeObjectURL(url); resolve(undefined); return }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUri = canvas.toDataURL("image/jpeg", 0.7)
          URL.revokeObjectURL(url)
          resolve(dataUri)
        } catch {
          URL.revokeObjectURL(url)
          resolve(undefined)
        }
      }
      video.onerror = () => { URL.revokeObjectURL(url); resolve(undefined) }
      video.src = url
    } catch {
      resolve(undefined)
    }
  })
}

/** Get video duration via HTMLVideoElement. */
async function getVideoDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const url   = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "metadata"
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(isFinite(video.duration) ? video.duration : 5)
    }
    video.onerror = () => { URL.revokeObjectURL(url); resolve(5) }
    video.src = url
  })
}

export function ClipDropzone({ onClipsReady, className }: ClipDropzoneProps) {
  const [clips, setClips]   = useState<ClipItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateClip = useCallback((id: string, patch: Partial<ClipItem>) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const uploadClip = useCallback(async (item: ClipItem) => {
    updateClip(item.id, { status: "uploading", progress: 0 })

    // Get signed upload URL
    const urlRes = await fetch("/api/clip-forge/upload-url", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename:    item.file.name,
        contentType: item.file.type,
        size:        item.file.size,
      }),
    })

    if (!urlRes.ok) {
      const { error } = await urlRes.json()
      updateClip(item.id, { status: "error", error: error ?? "Upload URL failed" })
      return
    }

    const { signedUrl, path } = await urlRes.json() as { signedUrl: string; path: string }

    // Upload via XHR for progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          updateClip(item.id, { progress: Math.round((e.loaded / e.total) * 100) })
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed: ${xhr.status}`))
      }
      xhr.onerror = () => reject(new Error("Network error during upload"))
      xhr.open("PUT", signedUrl)
      xhr.setRequestHeader("Content-Type", item.file.type)
      xhr.send(item.file)
    }).catch(err => {
      updateClip(item.id, { status: "error", error: err.message })
      throw err
    })

    // Extract duration + frame
    const [duration, frameDataUri] = await Promise.all([
      getVideoDuration(item.file),
      extractFrame(item.file),
    ])

    updateClip(item.id, { status: "done", path, duration, frameDataUri, progress: 100 })
  }, [updateClip])

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    const valid = arr
      .filter(f => ACCEPTED.includes(f.type) && f.size <= MAX_BYTES)
      .slice(0, MAX_CLIPS - clips.length)

    if (!valid.length) return

    const newItems: ClipItem[] = valid.map(f => ({
      id:       `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file:     f,
      status:   "pending",
      progress: 0,
    }))

    setClips(prev => [...prev, ...newItems])
    setUploading(true)

    await Promise.allSettled(newItems.map(uploadClip))

    setUploading(false)
  }, [clips.length, uploadClip])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const onInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ""
  }, [addFiles])

  const removeClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id))
  }

  const allDone = clips.length > 0 && clips.every(c => c.status === "done" || c.status === "error")
  const hasValidClips = clips.some(c => c.status === "done")

  const handleContinue = () => {
    const ready = clips
      .filter(c => c.status === "done" && c.path)
      .map(c => ({
        path:         c.path!,
        duration:     c.duration ?? 5,
        fileName:     c.file.name,
        frameDataUri: c.frameDataUri,
      }))
    if (ready.length) onClipsReady(ready)
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors text-center",
          dragging
            ? "border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20"
            : "border-border hover:border-indigo-300 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40",
          clips.length >= MAX_CLIPS && "pointer-events-none opacity-50",
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Drop video clips here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">
          MP4, MOV, WebM · Max 500 MB per clip · Up to {MAX_CLIPS} clips
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          multiple
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {/* Clip list */}
      {clips.length > 0 && (
        <ul className="space-y-2">
          {clips.map(clip => (
            <li
              key={clip.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <Film className="h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{clip.file.name}</p>
                {/* Progress bar */}
                <div className="mt-1 h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      clip.status === "done"  ? "bg-emerald-500" :
                      clip.status === "error" ? "bg-rose-500"    : "bg-indigo-500",
                    )}
                    style={{ width: `${clip.progress}%` }}
                  />
                </div>
              </div>

              {/* Status icon */}
              <span className="shrink-0">
                {clip.status === "uploading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                )}
                {clip.status === "done" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                {clip.status === "error" && (
                  <span className="text-xs text-rose-500" title={clip.error}>Error</span>
                )}
              </span>

              {/* Remove */}
              {!uploading && (
                <button
                  type="button"
                  onClick={() => removeClip(clip.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Continue button */}
      {allDone && (
        <Button
          disabled={!hasValidClips}
          onClick={handleContinue}
          className="w-full"
        >
          Continue with {clips.filter(c => c.status === "done").length} clip
          {clips.filter(c => c.status === "done").length !== 1 ? "s" : ""}
        </Button>
      )}
    </div>
  )
}
