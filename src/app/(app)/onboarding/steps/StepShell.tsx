import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface Props {
  title: string
  description?: string
  onBack?: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export function StepShell({ title, description, onBack, children, footer }: Props) {
  return (
    <div className="space-y-6">
      {/* Back link */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      )}

      {/* Heading */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">{description}</p>
        )}
      </div>

      {/* Content */}
      <div>{children}</div>

      {/* Footer slot */}
      {footer && <div>{footer}</div>}
    </div>
  )
}

export function StepActions({
  onBack,
  onNext,
  nextLabel = "Continue",
  loading = false,
  disabled = false,
}: {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex justify-between pt-2">
      {onBack ? (
        <Button variant="ghost" onClick={onBack} type="button">
          Back
        </Button>
      ) : (
        <div />
      )}
      <Button onClick={onNext} disabled={loading || disabled} type="button">
        {loading ? "Saving…" : nextLabel}
      </Button>
    </div>
  )
}
