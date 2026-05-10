import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

/**
 * DELETE /api/media/[id]
 * Removes the media_uploads DB record and the file from Supabase Storage.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // Fetch the record first so we know the storage_path
  const { data: upload } = await supabase
    .from("media_uploads")
    .select("id, storage_path, storage_provider")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Delete from storage (best-effort — don't fail if storage removal fails)
  if (upload.storage_path) {
    await supabase.storage
      .from("media")
      .remove([upload.storage_path])
      .catch(err => console.warn("media DELETE: storage removal failed:", err))
  }

  // Delete DB record
  const { error } = await supabase
    .from("media_uploads")
    .delete()
    .eq("id", id)
    .eq("brand_id", brand.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
