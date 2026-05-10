import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

/**
 * DELETE /api/calendar/[id]
 * Deletes a single calendar entry (and its linked post if one exists).
 * Only deletes entries belonging to the authenticated user's brand.
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

  // Verify ownership
  const { data: entry } = await supabase
    .from("content_calendar")
    .select("id, brand_id")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase
    .from("content_calendar")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ deleted: true })
}
