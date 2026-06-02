import Link from "next/link"
import { Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "PostFlow — Content sorted.",
  description:
    "Turn a short clip into a week of scheduled posts. Built for anyone who has an actual job to get back to.",
}

const STEPS = [
  {
    number: "01",
    headline: "Upload a clip",
    body: "Raw footage, a voice note, anything. PostFlow does the rest.",
  },
  {
    number: "02",
    headline: "Get a week of posts",
    body: "Captions, hashtags, images — written in your voice, ready to review.",
  },
  {
    number: "03",
    headline: "Scheduled. Done.",
    body: "One click sends them to Instagram, Facebook, and LinkedIn. 20 minutes, three platforms.",
  },
]

const PROOF = [
  { stat: "20 min", label: "per week" },
  { stat: "3×", label: "platforms at once" },
  { stat: "0", label: "cringe captions" },
]

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-[#1A203A] text-white flex flex-col">

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#0DA5A5]" />
          <span className="font-semibold text-sm tracking-tight">PostFlow</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-3xl mx-auto w-full">
        <p className="text-[#0DA5A5] text-sm font-medium tracking-widest uppercase mb-6">
          Built for people with an actual job to do
        </p>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
          You didn&apos;t start your business
          <br />
          to write captions at 11pm.
        </h1>

        <p className="text-white/60 text-lg sm:text-xl leading-relaxed max-w-xl mb-10">
          PostFlow turns one short clip into a week of content.
          Scheduled across Instagram, Facebook, and LinkedIn.
          Looks like you. Sounds like you. Takes 20 minutes.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
          <Link href="/signup" className="w-full sm:w-auto flex-1">
            <Button
              size="lg"
              className="w-full bg-[#0DA5A5] hover:bg-[#0b9494] text-white font-semibold text-base h-12 rounded-xl"
            >
              Start free
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto flex-1">
            <Button
              size="lg"
              variant="ghost"
              className="w-full border border-white/30 text-white hover:bg-white/10 hover:text-white h-12 rounded-xl text-base"
            >
              Sign in
            </Button>
          </Link>
        </div>
        <p className="text-white/30 text-xs mt-4">No agency. No budget. No problem.</p>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <section className="border-y border-white/10 py-8">
        <div className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-4 text-center">
          {PROOF.map(({ stat, label }) => (
            <div key={label}>
              <p className="text-3xl sm:text-4xl font-bold text-[#0DA5A5]">{stat}</p>
              <p className="text-white/40 text-sm mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20 w-full">
        <h2 className="text-2xl font-semibold text-center mb-12">
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {STEPS.map(({ number, headline, body }) => (
            <div key={number} className="space-y-3">
              <span className="text-[#0DA5A5] text-xs font-bold tracking-widest uppercase">
                {number}
              </span>
              <h3 className="text-lg font-semibold">{headline}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
      <section className="border-t border-white/10 py-16 text-center px-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">
          Three posts a week. Scheduled. Done.
        </h2>
        <p className="text-white/50 mb-8 text-base">
          Stop staring at a blank caption field.
        </p>
        <Link href="/signup">
          <Button
            size="lg"
            className="bg-[#0DA5A5] hover:bg-[#0b9494] text-white font-semibold px-10 h-12 rounded-xl text-base"
          >
            Get started free
          </Button>
        </Link>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-6 text-center">
        <p className="text-white/25 text-xs">
          © {new Date().getFullYear()} PostFlow · postflow.app
        </p>
      </footer>

    </main>
  )
}
