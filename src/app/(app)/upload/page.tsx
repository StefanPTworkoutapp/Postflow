import { MediaUploader } from "./MediaUploader"

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media Library</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Upload photos and videos to use when generating posts.
        </p>
      </div>
      <MediaUploader />
    </div>
  )
}
