-- Add goals array to brands
--
-- getBrandContext already reads b.goals (with a fallback to [primary_goal])
-- and Step2Goals saves goals: selected[], but the column was never created.
-- This caused a 400 "Could not find the 'goals' column" on every Step2 save,
-- meaning users could never advance past Step2.
--
-- primary_goal stays as the single canonical goal for the CHECK constraint;
-- goals[] stores the full ranked list as selected in the onboarding wizard.

ALTER TABLE postflow.brands
  ADD COLUMN IF NOT EXISTS goals TEXT[] DEFAULT NULL;
