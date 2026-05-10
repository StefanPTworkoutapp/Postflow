/**
 * Supabase service-role client.
 * Use ONLY in server-side code that runs without a user session:
 *   - Inngest background jobs
 *   - Webhook handlers
 *   - One-off admin scripts
 *
 * ⚠️  Never expose the service key to the browser.
 * ⚠️  RLS is bypassed — always scope queries with brand_id / account_id checks.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db:   { schema: "postflow" },
      auth: { persistSession: false },
    }
  )
}
