-- Adds tone learning loop output columns to brands.
-- Populated weekly by the Inngest toneLearningLoop job when 5+ same-type
-- feedback signals are detected. Surfaces in Brand > Voice tab as a dismissable card.

ALTER TABLE postflow.brands
  ADD COLUMN IF NOT EXISTS tone_suggestion      TEXT,
  ADD COLUMN IF NOT EXISTS tone_suggestion_type TEXT,
  ADD COLUMN IF NOT EXISTS tone_suggestion_at   TIMESTAMPTZ;
