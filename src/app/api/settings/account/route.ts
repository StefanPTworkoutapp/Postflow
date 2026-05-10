import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// PATCH /api/settings/account — update display name
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name } = await request.json() as { name: string }

    const { error } = await supabase
      .from("accounts")
      .update({ name })
      .eq("id", user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
