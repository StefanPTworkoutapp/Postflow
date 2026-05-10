import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/auth/buffer
 * Starts the Buffer OAuth flow — redirects user to Buffer's authorise page.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId    = process.env.BUFFER_CLIENT_ID
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL
  if (!clientId || !appUrl) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:480px;margin:auto">
        <h2 style="color:#dc2626">Buffer not configured</h2>
        <p>Add these variables to your <code>.env.local</code> and restart the dev server:</p>
        <pre style="background:#f4f4f5;padding:1rem;border-radius:8px;font-size:0.85rem">BUFFER_CLIENT_ID=your_client_id
BUFFER_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000</pre>
        <p style="margin-top:1rem">Get your credentials at <a href="https://buffer.com/developers/apps" target="_blank">buffer.com/developers/apps</a></p>
        <button onclick="window.close()" style="margin-top:1.5rem;padding:0.5rem 1.25rem;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem">Close this tab</button>
      </body></html>`,
      { status: 503, headers: { "Content-Type": "text/html" } }
    )
  }

  const redirectUri = `${appUrl}/api/auth/buffer/callback`
  const authUrl = new URL("https://bufferapp.com/oauth2/authorize")
  authUrl.searchParams.set("client_id",    clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type","code")

  return NextResponse.redirect(authUrl.toString())
}
