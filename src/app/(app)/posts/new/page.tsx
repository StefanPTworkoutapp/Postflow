import { redirect } from "next/navigation"
import { getActiveBrand } from "@/lib/server/brand/getActiveBrand"
import { PostCreator } from "./PostCreator"

export default async function NewPostPage() {
  const brand = await getActiveBrand()
  if (!brand) redirect("/onboarding")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New post</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Pick a template, describe your topic, and let Claude write the first draft.
        </p>
      </div>
      <PostCreator />
    </div>
  )
}
