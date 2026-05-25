/**
 * useTrendConcepts — manages concept generation state for the Trend Builder.
 *
 * Encapsulates the "Step 1 → 2: generate concepts" logic that lives inline
 * in TrendClient.tsx. Extracted here so:
 *   - The loading/error/result state is centrally managed.
 *   - Future callers (dashboard quick-start, re-generate flow) can reuse it.
 *   - Tests can exercise concept generation without rendering TrendClient.
 *
 * Usage:
 *   const { concepts, jobId, generating, error, generateConcepts } = useTrendConcepts()
 */

import { useState, useCallback } from "react"
import type { TrendConcept } from "@/lib/server/trends/trend-filter"

export interface ConceptWithId extends TrendConcept {
  id: string | null
}

interface GenerateConceptsInput {
  platform: string
  clips: Array<{ path: string; duration: number; frameDataUri: string }>
}

interface UseTrendConceptsResult {
  concepts:         ConceptWithId[]
  jobId:            string | null
  generating:       boolean
  error:            string | null
  generateConcepts: (input: GenerateConceptsInput) => Promise<void>
  resetConcepts:    () => void
}

export function useTrendConcepts(): UseTrendConceptsResult {
  const [concepts,   setConcepts]   = useState<ConceptWithId[]>([])
  const [jobId,      setJobId]      = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const generateConcepts = useCallback(async ({ platform, clips }: GenerateConceptsInput) => {
    setGenerating(true)
    setError(null)
    setConcepts([])
    setJobId(null)

    try {
      const res = await fetch("/api/trend/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, clips }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to generate concepts")
        return
      }
      setJobId(data.jobId as string)
      setConcepts(data.concepts as ConceptWithId[])
    } catch {
      setError("Network error — please try again")
    } finally {
      setGenerating(false)
    }
  }, [])

  const resetConcepts = useCallback(() => {
    setConcepts([])
    setJobId(null)
    setError(null)
  }, [])

  return { concepts, jobId, generating, error, generateConcepts, resetConcepts }
}
