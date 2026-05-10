"use client"

import { useState } from "react"
import { ExternalLink, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  title:   string
  detail:  React.ReactNode
  tip?:    string
}

const STEPS: Step[] = [
  {
    title:  "Create a free Buffer account",
    detail: <>Go to <a href="https://buffer.com" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline inline-flex items-center gap-0.5">buffer.com <ExternalLink className="h-3 w-3" /></a> and sign up. The free plan includes 3 social channels and up to 10 scheduled posts per channel — enough to get started.</>,
    tip:    "Already have a Buffer account? Skip to step 2.",
  },
  {
    title:  "Connect your social channels in Buffer",
    detail: <>After signing in to Buffer, click <strong>Channels</strong> in the left sidebar, then <strong>Connect a channel</strong>. Connect your Instagram Business, LinkedIn, Facebook Page, or any other platform you use.<br /><br />Buffer will ask you to log in to each platform and grant posting permissions.</>,
    tip:    "Instagram must be a Business or Creator account — personal accounts can't be auto-posted to by any third-party app (this is Meta's rule, not Buffer's).",
  },
  {
    title:  "Get your Buffer API token",
    detail: <>Go to <a href="https://publish.buffer.com/profile/settings/api" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline inline-flex items-center gap-0.5">Buffer API Settings <ExternalLink className="h-3 w-3" /></a>. You&apos;ll see a personal access token — click <strong>Copy</strong>.</>,
    tip:    "Keep this token private — it gives full access to your Buffer account. Don't share it or paste it anywhere else.",
  },
  {
    title:  "Paste the token here and click Connect",
    detail: <>Paste your token into the field above and click <strong>Connect</strong>. PostFlow will automatically pull all your connected channels. Done — PostFlow can now schedule posts to your social accounts through Buffer.</>,
  },
]

interface Props {
  isConnected: boolean
}

export function BufferSetupGuide({ isConnected }: Props) {
  const [open, setOpen] = useState(!isConnected)

  return (
    <div className="rounded-xl border border-dashed border-[hsl(var(--border))] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))]/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📖</span>
          <div>
            <p className="text-sm font-medium">How to set up Buffer</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {isConnected
                ? "Buffer is connected. Expand to see the guide."
                : "Follow these steps to connect your social accounts."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isConnected && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-medium">
              Setup required
            </span>
          )}
          {open
            ? <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            : <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          }
        </div>
      </button>

      {/* Steps */}
      {open && (
        <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 px-4 pt-4 pb-5 space-y-5">
          <ol className="space-y-4">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3">
                {/* Step number / done indicator */}
                <div className="shrink-0 mt-0.5">
                  {isConnected && i < 3 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <span className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                      isConnected && i === 3
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                    )}>
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                    {step.detail}
                  </p>
                  {step.tip && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5 leading-relaxed">
                      💡 {step.tip}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Buffer pricing note */}
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 space-y-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <p className="font-medium text-foreground text-sm">Buffer plan overview</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
              {[
                { name: "Free",        price: "€0/mo",  detail: "3 channels · 10 posts each" },
                { name: "Essentials",  price: "~€6/mo", detail: "1 user · unlimited posts · 10 channels" },
                { name: "Team",        price: "~€12/mo",detail: "3 users · unlimited posts · 10 channels" },
              ].map(plan => (
                <div key={plan.name} className="rounded-md bg-[hsl(var(--muted))]/40 px-3 py-2">
                  <p className="font-medium text-foreground">{plan.name} · <span className="font-normal">{plan.price}</span></p>
                  <p>{plan.detail}</p>
                </div>
              ))}
            </div>
            <p className="pt-0.5">
              PostFlow schedules the post content — Buffer handles the actual publishing to each platform. Your API token is stored securely and only used to send posts.{" "}
              <a href="https://buffer.com/pricing" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline inline-flex items-center gap-0.5">
                See full Buffer pricing <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
