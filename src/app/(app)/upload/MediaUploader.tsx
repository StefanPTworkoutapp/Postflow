"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, X, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface UploadFile {
  id:       string
  file:     File
  preview:  string | null
  status:   "pending" | "uploading" | "done" | "error"
  error?:   string
  publicUrl?: string
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"]
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

function uid() { return Math.random().toString(36).slice(2) }

export function MediaUploader() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [draggingOver, setDraggingOver] = useState(false)
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

  async function uploadFile(item: UploadFile) {
    setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "uploading" } : f))

    try {
      // 1. Get signed URL
      const urlRes = await fetch("/api/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename:    item.file.name,
          contentType: item.file.type,
          size:        item.file.size,
        }),
      })
      const { signedUrl, path, publicUrl, error: urlError } = await urlRes.json()
      if (urlError) throw new Error(urlError)

      // 2. Upload directly to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method:  "PUT",
        headers: { "Content-Type": item.file.type },
        body:    item.file,
      })
      if (!uploadRes.ok) throw new Error(`Storage upload failed (${uploadRes.status})`)

      // 3. Confirm with our API
      const confirmRes = await fetch("/api/media/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path, publicUrl,
          filename:    item.file.name,
          contentType: item.file.type,
          size:        item.file.size,
        }),
      })
      const { error: confirmError } = await confirmRes.json()
      if (confirmError) throw new Error(confirmError)

      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "done", publicUrl } : f))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "error", error: msg } : f))
    }
  }

  async function uploadAll() {
    const pending = files.filter(f => f.status === "pending" || f.status === "error")
    await Promise.all(pending.map(uploadFile))
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
            JPG, PNG, WebP, GIF, MP4, MOV · max 50 MB per file
          </p>
        </div>
      </div>
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
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
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
                <div className="p-2 space-y-0.5">
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
