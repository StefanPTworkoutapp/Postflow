-- Grant schema and table privileges to Supabase's built-in Postgres roles.
--
-- PostgREST (the Supabase Data API) switches from the `authenticator` superuser
-- role to either `anon` (unauthenticated) or `authenticated` (JWT user) for
-- every request. Without GRANT USAGE on the schema, PostgREST cannot reach
-- any table and returns "permission denied for schema postflow".
--
-- These grants are separate from RLS policies. RLS controls which ROWS a user
-- can see/modify. GRANTs control whether the role can access the schema at all.
-- Both layers must be in place for queries to succeed.
--
-- service_role is a superuser and bypasses RLS — it already has access, but
-- we include it here for completeness and future-proofing.

-- ── Schema access ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA postflow TO anon, authenticated, service_role;

-- ── Table privileges ──────────────────────────────────────────────────────────
-- anon: read-only access (public pages like the client portal read brand info)
GRANT SELECT ON ALL TABLES IN SCHEMA postflow TO anon;

-- authenticated: full CRUD (RLS policies narrow this to the user's own rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA postflow TO authenticated;

-- service_role: full access (used by Inngest jobs and admin routes)
GRANT ALL ON ALL TABLES IN SCHEMA postflow TO service_role;

-- ── Sequences (needed for DEFAULT gen_random_uuid() on INSERT) ────────────────
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA postflow TO authenticated, service_role;

-- ── Default privileges — apply grants to tables created in future migrations ──
ALTER DEFAULT PRIVILEGES IN SCHEMA postflow
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA postflow
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA postflow
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA postflow
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
