import { NextResponse } from "next/server"

/**
 * This route is no longer used.
 * Buffer's new public API uses personal access tokens, not OAuth.
 * Token setup is handled via POST /api/settings/buffer.
 */
export async function GET() {
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings`
  )
}
