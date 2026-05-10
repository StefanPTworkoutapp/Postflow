import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { getBufferChannels, bufferServiceToPlatform } from "@/lib/server/buffer/client"

/**
 * POST /api/settings/buffer
 * Saves the Buffer API token and syncs connected channels into social_accounts.
 * Body: { access_token: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const { access_token } = await request.json() as { access_token: string }
    if (!access_token?.trim()) {
      return NextResponse.json({ error: "API token is required" }, { status: 400 })
    }

    const token = access_token.trim()

    // Validate token + fetch channels from Buffer
    const channels = await getBufferChannels(token)
    if (!channels.length) {
      return NextResponse.json(
        { error: "No channels found. Connect at least one social account in Buffer first." },
        { status: 400 }
      )
    }

    // Save each channel: manual upsert (check existence → update or insert)
    // Avoids relying on a DB unique constraint that may not exist yet.
    const saved: { id: string; platform: string; account_handle: string | null; buffer_profile_id: string | null; is_active: boolean }[] = []
    const errors: string[] = []

    for (const channel of channels) {
      const platform = bufferServiceToPlatform(channel.service)

      // Check if a row already exists for this brand+platform
      const { data: existing } = await supabase
        .from("social_accounts")
        .select("id")
        .eq("brand_id", brand.id)
        .eq("platform", platform)
        .maybeSingle()

      if (existing?.id) {
        // UPDATE existing row
        const { data: updated, error: updateErr } = await supabase
          .from("social_accounts")
          .update({
            account_handle:    channel.name,
            buffer_profile_id: channel.id,
            access_token:      token,
            is_active:         true,
          })
          .eq("id", existing.id)
          .select("id, platform, account_handle, buffer_profile_id, is_active")
          .single()

        if (updateErr) {
          console.error(`[buffer] update error for ${platform}:`, updateErr.message)
          errors.push(`${platform}: ${updateErr.message}`)
        } else if (updated) {
          saved.push(updated)
        }
      } else {
        // INSERT new row
        const { data: inserted, error: insertErr } = await supabase
          .from("social_accounts")
          .insert({
            brand_id:          brand.id,
            platform,
            account_handle:    channel.name,
            buffer_profile_id: channel.id,
            access_token:      token,
            is_active:         true,
          })
          .select("id, platform, account_handle, buffer_profile_id, is_active")
          .single()

        if (insertErr) {
          console.error(`[buffer] insert error for ${platform}:`, insertErr.message)
          errors.push(`${platform}: ${insertErr.message}`)
        } else if (inserted) {
          saved.push(inserted)
        }
      }
    }

    if (saved.length === 0) {
      return NextResponse.json(
        { error: `Could not save any channels. Errors: ${errors.join("; ")}` },
        { status: 500 }
      )
    }

    revalidatePath("/settings")

    return NextResponse.json({
      success:        true,
      socialAccounts: saved,
      channels:       channels.map(c => ({
        platform: bufferServiceToPlatform(c.service),
        name:     c.name,
      })),
      ...(errors.length ? { warnings: errors } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[buffer] POST error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/buffer
 * Removes all Buffer-connected social accounts for this brand.
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const { error } = await supabase
      .from("social_accounts")
      .delete()
      .eq("brand_id", brand.id)
      .not("buffer_profile_id", "is", null)

    if (error) {
      console.error("[buffer] DELETE error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath("/settings")
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
