"use client"

/**
 * SyncButton — triggers POST /api/analytics/sync for the current brand.
 * Shows a loading spinner during the request, then refreshes the page.
 */

import { useState }       from "react"
import { useRouter }      from "next/navigation"
import { RefreshCw }      from "lucide-react"
import { Button }         from "@/components/ui/button"

export function SyncButton() {
  const router          = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult]   = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setResult(null)
    try {
      const res  = await fetch("/api/analytics/sync", { method: "POST" })
      const data = await res.json() as {
        synced?: number
        brands_processed?: number
        error?: string
      }

      if (!res.ok || data.error) {
        setResult(`Sync failed: ${data.error ?? "unknown error"}`)
      } else {
        setResult(`Synced ${data.synced ?? 0} post${(data.synced ?? 0) !== 1 ? "s" : ""}`)
        // Refresh server data without a full reload
        router.refresh()
      }
    } catch {
      setResult("Network error — try again")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-2"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing…" : "Sync now"}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  )
}
