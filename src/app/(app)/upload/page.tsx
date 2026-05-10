"use client"

import { useState } from "react"
import { MediaUploader } from "./MediaUploader"
import { MediaGallery }  from "./MediaGallery"

export default function UploadPage() {
  // Increment to trigger gallery refresh after an upload batch completes
  const [galleryKey, setGalleryKey] = useState(0)

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media Library</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Upload photos and videos. PostFlow tags them with AI and matches them to upcoming posts.
        </p>
      </div>

      {/* Uploader */}
      <MediaUploader onUploadComplete={() => setGalleryKey(k => k + 1)} />

      {/* Gallery — refreshes after each upload batch */}
      <div className="space-y-3">
        <h2 className="text-base font-medium">Your Library</h2>
        <MediaGallery refreshKey={galleryKey} />
      </div>
    </div>
  )
}
