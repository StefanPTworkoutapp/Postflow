"use client"

import { useState } from "react"
import { MediaUploader } from "../upload/MediaUploader"
import { MediaGallery }  from "../upload/MediaGallery"

export function UploadTabContent() {
  const [galleryKey, setGalleryKey] = useState(0)

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Media Library</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
          Upload photos and videos. PostFlow tags them with AI and matches them to upcoming posts.
        </p>
      </div>

      <MediaUploader onUploadComplete={() => setGalleryKey(k => k + 1)} />

      <div className="space-y-3">
        <h3 className="text-base font-medium">Your Library</h3>
        <MediaGallery refreshKey={galleryKey} />
      </div>
    </div>
  )
}
