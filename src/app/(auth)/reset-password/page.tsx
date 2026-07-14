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

  // On load, establish the recovery session. Supabase recovery links land here
  // with the token in the URL hash; the browser client (detectSessionInUrl)
  // parses it and emits PASSWORD_RECOVERY / SIGNED_IN. We also read any error
  // the hash carries (e.g. otp_expired) to show a clear "link expired" state.
  useEffect(() => {
    let settled = false

    // 1. Explicit error in the hash → expired/invalid link.
    if (typeof window !== "undefined" && window.location.hash) {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
      if (params.get("error") || params.get("error_code")) {
        setPhase("invalid")
        return
      }
    }

    // 2. React to the recovery session being established from the URL hash.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        settled = true
        setPhase("ready")
      }
    })

    // 3. Also check synchronously in case the session was already parsed
    //    before the listener attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !settled) {
        settled = true
        setPhase("ready")
      }
    })

    // 4. Fallback: if nothing established a session shortly after load, the
    //    link is invalid or already consumed.
    const timeout = setTimeout(() => {
      if (!settled) setPhase(prev => (prev === "checking" ? "invalid" : prev))
    }, 4000)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
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
