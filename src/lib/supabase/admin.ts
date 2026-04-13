import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createAdminClient(): ReturnType<typeof createClient> {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
