"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

type Phase = "checking" | "ready" | "invalid" | "done"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [phase, setPhase] = useState<Phase>("checking")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // On load, establish the recovery session. Supabase can deliver the recovery
  // credential in three different shapes depending on the project's auth flow
  // and the mail client that opened the link, so we handle ALL of them:
  //
  //   • ?code=…                         → exchangeCodeForSession  (PKCE, same-device)
  //   • ?token_hash=…&type=recovery     → verifyOtp               (device-independent, Supabase's recommended email path)
  //   • #access_token=…&refresh_token=… → setSession              (implicit hash)
  //
  // We also listen for PASSWORD_RECOVERY / SIGNED_IN and check getSession() as a
  // belt-and-suspenders (detectSessionInUrl may have already parsed the hash),
  // and read any explicit error in the URL (e.g. otp_expired) to show a clear
  // "link expired" state. "invalid" is only shown AFTER we genuinely fail to
  // establish a session — the async exchange/verify is awaited first so we never
  // false-positive while establishment is still in flight.
  useEffect(() => {
    let settled = false
    let unmounted = false

    const markReady = () => {
      if (settled || unmounted) return
      settled = true
      setPhase("ready")
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        markReady()
      }
    })

    async function establish() {
      if (typeof window === "undefined") return

      const query = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))

      // 1. Explicit error carried in the query or hash → expired/invalid link.
      const errCode =
        query.get("error_code") ??
        query.get("error") ??
        hash.get("error_code") ??
        hash.get("error")
      if (errCode) {
        if (!settled && !unmounted) setPhase("invalid")
        return
      }

      // 2. Already-established session (e.g. detectSessionInUrl parsed the hash
      //    before we ran, or the user reloaded with a live recovery session).
      const existing = await supabase.auth.getSession()
      if (existing.data.session) {
        markReady()
        return
      }

      // 3. PKCE, same-device: ?code=…
      const code = query.get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          markReady()
          return
        }
      }

      // 4. Device-independent email link: ?token_hash=…&type=recovery
      const tokenHash = query.get("token_hash")
      const type = query.get("type")
      if (tokenHash && (type === "recovery" || type === null)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        })
        if (!error) {
          markReady()
          return
        }
      }

      // 5. Implicit hash: #access_token=…&refresh_token=…
      const accessToken = hash.get("access_token")
      const refreshToken = hash.get("refresh_token")
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!error) {
          markReady()
          return
        }
      }

      // 6. Nothing worked. Give the onAuthStateChange listener a brief grace
      //    window (detectSessionInUrl may still be resolving the hash), then
      //    conclude the link is invalid or already consumed.
      setTimeout(() => {
        if (!settled && !unmounted) setPhase("invalid")
      }, 1500)
    }

    void establish()

    return () => {
      unmounted = true
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setPhase("done")
    setSaving(false)
    // Give the user a beat to read the confirmation, then send them in.
    setTimeout(() => {
      router.push("/dashboard")
      router.refresh()
    }, 1800)
  }

  if (phase === "checking") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center justify-center gap-2">
            <Image src="/postflow-logo-icon.png" alt="" width={28} height={28} className="rounded-md" priority />
            <span className="text-2xl font-bold tracking-tight">PostFlow</span>
          </div>
          <CardTitle className="text-xl">Verifying your link…</CardTitle>
          <CardDescription>One moment while we check your reset link.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (phase === "invalid") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center justify-center gap-2">
            <Image src="/postflow-logo-icon.png" alt="" width={28} height={28} className="rounded-md" />
            <span className="text-2xl font-bold tracking-tight">PostFlow</span>
          </div>
          <CardTitle className="text-xl">This link has expired</CardTitle>
          <CardDescription>
            Password reset links can only be used once and expire after about an hour.
            Request a fresh one and we'll email it right over.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/forgot-password" className="font-medium text-[hsl(var(--foreground))] underline-offset-4 hover:underline">
            Request a new link
          </Link>
        </CardFooter>
      </Card>
    )
  }

  if (phase === "done") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center justify-center gap-2">
            <Image src="/postflow-logo-icon.png" alt="" width={28} height={28} className="rounded-md" />
            <span className="text-2xl font-bold tracking-tight">PostFlow</span>
          </div>
          <CardTitle className="text-xl">Password updated ✓</CardTitle>
          <CardDescription>Taking you to your dashboard…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // phase === "ready"
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex items-center justify-center gap-2">
          <Image src="/postflow-logo-icon.png" alt="" width={28} height={28} className="rounded-md" priority />
          <span className="text-2xl font-bold tracking-tight">PostFlow</span>
        </div>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>Enter a new password for your account.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          {error && (
            <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <Link href="/login" className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
