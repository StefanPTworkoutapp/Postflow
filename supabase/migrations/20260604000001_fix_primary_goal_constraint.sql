-- Add 'showcase' to the primary_goal CHECK constraint.
--
-- The GOALS array in the frontend has always had 'showcase' as a valid option
-- ("Showcase my work"), but the original constraint omitted it.
-- Any user selecting 'showcase' as their first goal hit a 400 constraint
-- violation and could not advance past Step 2 of onboarding.
--
-- Strategy: drop the old CHECK and recreate it with 'showcase' included.

ALTER TABLE postflow.brands
  DROP CONSTRAINT IF EXISTS brands_primary_goal_check;

ALTER TABLE postflow.brands
  ADD CONSTRAINT brands_primary_goal_check
  CHECK (primary_goal IN (
    'lead_generation',
    'brand_awareness',
    'engagement',
    'showcase',
    'sales'
  ));
