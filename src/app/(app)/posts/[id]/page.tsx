import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { PostEditor } from "./PostEditor"

interface Props {
  params: Promise<{ id: string }>
}

export default async function PostPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const brand = await getBrand()

  if (!brand) redirect("/onboarding")

  const { data: post, error } = await supabase
    .from("posts")
    .select("*, content_calendar(id, scheduled_date, topic, content_pillar, media_brief, required_media_type, media_urls)")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .single()

  if (error || !post) notFound()

  const cal = post.content_calendar as {
    id?: string
    scheduled_date?: string
    topic?: string
    content_pillar?: string
    media_brief?: string | null
    required_media_type?: string | null
    media_urls?: string[] | null
  } | null

  return (
    <div className="space-y-6">
      <PostEditor
        post={{
          id:               post.id,
          platform:         post.platform,
          caption:          post.caption ?? "",
          hashtags:         (post.hashtags as string[]) ?? [],
          cta:              post.cta ?? null,
          status:           post.status,
          media_ids:        (post.media_ids as string[]) ?? [],
          template_slug:        post.template_slug ?? null,
          slide_content:        (post.slide_content as any) ?? null,
          carousel_image_urls:  (post.carousel_image_urls as string[] | null) ?? null,
          content_calendar:     cal,
        }}
        brandName={brand.name}
        industry={brand.industry ?? ""}
      />
    </div>
  )
}
