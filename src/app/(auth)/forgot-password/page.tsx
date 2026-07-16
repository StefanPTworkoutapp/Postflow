"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflowsocials.app"

export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createClient())
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Native Supabase recovery email. resetPasswordForEmail is anti-enumeration
    // by default: it resolves without error whether or not the address maps to
    // an account, and Supabase only sends when it does. We therefore always show
    // the same generic confirmation and never reveal existence either way.
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_BASE_URL}/reset-password`,
      })
    } catch {
      // Even an unexpected/network error must not reveal anything — show the
      // same confirmation.
    }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center justify-center gap-2">
            <Image src="/postflow-logo-icon.png" alt="" width={28} height={28} className="rounded-md" />
            <span className="text-2xl font-bold tracking-tight">PostFlow</span>
          </div>
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            If an account exists for <strong>{email}</strong>, a password reset link is on its way.
            It expires in about an hour.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex items-center justify-center gap-2">
          <Image src="/postflow-logo-icon.png" alt="" width={28} height={28} className="rounded-md" priority />
          <span className="text-2xl font-bold tracking-tight">PostFlow</span>
        </div>
        <CardTitle className="text-xl">Forgot your password?</CardTitle>
        <CardDescription>Enter your email and we'll send you a reset link.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-[hsl(var(--foreground))] underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
