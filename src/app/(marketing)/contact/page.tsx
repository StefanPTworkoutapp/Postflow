"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"

function Logo({ size = 6 }: { size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-lg bg-[#0DA5A5] flex items-center justify-center shrink-0`}>
      <svg className="w-[58%] h-[58%] text-white" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2.18L13.18 6 8 8.82 2.82 6 8 3.18z"/>
      </svg>
    </div>
  )
}

export default function ContactPage() {
  const [name,    setName]    = useState("")
  const [email,   setEmail]   = useState("")
  const [company, setCompany] = useState("")
  const [message, setMessage] = useState("")
  const [status,  setStatus]  = useState<"idle" | "sending" | "done" | "error">("idle")
  const [errMsg,  setErrMsg]  = useState("")

  // Timing — set when form mounts, sent with submission for bot detection
  const mountedAt = useRef<number>(0)
  useEffect(() => { mountedAt.current = Date.now() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    setErrMsg("")

    try {
      const res  = await fetch("/api/contact", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          message,
          website: "",   // honeypot — always blank from real users
          _t:      mountedAt.current,
        }),
      })
      const data = await res.json() as { success?: boolean; error?: string }

      if (!res.ok || !data.success) {
        setErrMsg(data.error ?? "Something went wrong. Please try again.")
        setStatus("error")
      } else {
        setStatus("done")
      }
    } catch {
      setErrMsg("Network error. Please try again.")
      setStatus("error")
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white font-[family-name:var(--font-geist-sans)] antialiased">

      {/* Nav */}
      <nav className="border-b border-white/[0.05] bg-[#0A0F1E]/80 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/join" className="flex items-center gap-2.5">
            <Logo size={6} />
            <span className="font-semibold text-sm tracking-tight">PostFlow</span>
          </Link>
          <Link href="/login" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-[1fr_1.4fr] gap-16 items-start">

        {/* Left — copy */}
        <div className="md:pt-2">
          <p className="text-[#0DA5A5] text-xs font-bold tracking-[0.15em] uppercase mb-4">Agency & team plans</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-5">
            Managing content for multiple clients?
          </h1>
          <p className="text-white/45 leading-relaxed mb-8">
            PostFlow has Studio, Business, and Agency plans built for teams running social across more than one brand.
            We&apos;ll find the right setup for your workflow.
          </p>
          <div className="space-y-4 text-sm">
            {[
              { label: "Volume pricing", body: "Up to unlimited brands, 20 team members, 500 GB storage." },
              { label: "White-label option", body: "Remove PostFlow branding on Business and Agency plans." },
              { label: "Dedicated support", body: "Direct line, not a support queue." },
            ].map(({ label, body }) => (
              <div key={label} className="flex gap-3">
                <svg className="w-4 h-4 text-[#0DA5A5] shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-white/55">
                  <span className="text-white/80 font-medium">{label} — </span>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#141929] p-8">
          {status === "done" ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-[#0DA5A5]/15 border border-[#0DA5A5]/30 flex items-center justify-center mx-auto mb-5">
                <svg className="w-6 h-6 text-[#0DA5A5]" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="font-semibold text-lg mb-2">Message sent.</p>
              <p className="text-white/40 text-sm">We&apos;ll get back to you within one business day.</p>
              <Link href="/join" className="inline-block mt-8 text-sm text-[#0DA5A5] hover:underline">
                ← Back to PostFlow
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Honeypot — hidden from humans, bots fill it */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute opacity-0 h-0 w-0 pointer-events-none"
              />

              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Name" required>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jan de Vries"
                    required
                    className={inputCls}
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jan@agency.nl"
                    required
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Company / agency" required={false}>
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="Your agency name (optional)"
                  className={inputCls}
                />
              </Field>

              <Field label="What do you need?" required>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="How many brands, how many team members, any specific requirements..."
                  required
                  rows={5}
                  className={`${inputCls} resize-none`}
                />
              </Field>

              {status === "error" && errMsg && (
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 7a1 1 0 110-2 1 1 0 010 2z"/>
                  </svg>
                  {errMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full bg-[#0DA5A5] hover:bg-[#0b9494] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {status === "sending" ? "Sending…" : "Send message"}
              </button>

              <p className="text-xs text-white/20 text-center">
                Or email us directly at{" "}
                <a href="mailto:hello@postflowsocials.app" className="text-white/35 hover:text-white/55 transition-colors">
                  hello@postflowsocials.app
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const inputCls =
  "w-full bg-[#0A0F1E] border border-white/[0.09] hover:border-white/[0.15] focus:border-[#0DA5A5]/60 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 transition-colors"

function Field({
  label,
  required,
  children,
}: {
  label:    string
  required: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/45 flex items-center gap-1">
        {label}
        {required && <span className="text-[#0DA5A5]">*</span>}
      </label>
      {children}
    </div>
  )
}
