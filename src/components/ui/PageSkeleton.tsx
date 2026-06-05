/**
 * PageSkeleton — generic loading placeholder for pages fetching async data.
 * Renders N skeleton rows with a fade-out effect for a natural loading feel.
 */

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-lg bg-[hsl(var(--muted))]"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  )
}
