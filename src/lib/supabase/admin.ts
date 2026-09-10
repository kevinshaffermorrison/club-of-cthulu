import { createClient } from "@supabase/supabase-js";
import { publicSupabaseUrl, secretSupabaseKey } from "./env";

export function createAdminSupabase() {
  const url = publicSupabaseUrl();
  const key = secretSupabaseKey();
  if (!url || !key) {
    throw new Error("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
