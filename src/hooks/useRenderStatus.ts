/**
 * useRenderStatus — polls a clip-forge job for render completion.
 *
 * Replaces the inline polling logic in CreateClient.tsx with a reusable hook.
 * Polls every 3 seconds, stops automatically when status is "ready" or "failed".
 *
 * Usage:
 *   const { jobStatus, pollError, startPolling, stopPolling } = useRenderStatus()
 *   // After job is created:
 *   startPolling(jobId)
 */

import { useState, useCallback, useEffect, useRef } from "react"

export interface JobStatus {
  status:         string
  renderProgress: number
  outputVideoUrl: string | null
  outputCaption:  string | null
  outputHashtags: string[] | null
}

interface UseRenderStatusResult {
  jobStatus:   JobStatus | null
  pollError:   string | null
  isPolling:   boolean
  startPolling: (jobId: string) => void
  stopPolling:  () => void
  resetStatus:  () => void
}

const POLL_INTERVAL_MS = 3_000
const TERMINAL_STATUSES = new Set(["ready", "failed"])

export function useRenderStatus(): UseRenderStatusResult {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const jobIdRef    = useRef<string | null>(null)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  const pollOnce = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/clip-forge/${jobId}`)
      if (!res.ok) {
        setPollError("Status check failed")
        return
      }
      const data = await res.json() as JobStatus
      setJobStatus(data)

      if (TERMINAL_STATUSES.has(data.status)) {
        stopPolling()
        if (data.status === "failed") {
          setPollError("Render failed — please try again.")
        }
      }
    } catch {
      setPollError("Network error while checking render status.")
    }
  }, [stopPolling])

  const startPolling = useCallback((jobId: string) => {
    stopPolling()
    jobIdRef.current = jobId
    setIsPolling(true)
    setPollError(null)

    // Poll immediately, then at intervals
    void pollOnce(jobId)
    intervalRef.current = setInterval(() => {
      void pollOnce(jobId)
    }, POLL_INTERVAL_MS)
  }, [pollOnce, stopPolling])

  const resetStatus = useCallback(() => {
    stopPolling()
    setJobStatus(null)
    setPollError(null)
  }, [stopPolling])

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling])

  return { jobStatus, pollError, isPolling, startPolling, stopPolling, resetStatus }
}
