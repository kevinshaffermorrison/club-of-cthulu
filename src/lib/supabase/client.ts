import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseKey, publicSupabaseUrl } from "./env";

export function createBrowserSupabase() {
  const url = publicSupabaseUrl();
  const key = publicSupabaseKey();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key");
  }
  return createBrowserClient(url, key);
}

export function supabaseConfigured(): boolean {
  return Boolean(publicSupabaseUrl() && publicSupabaseKey());
}
