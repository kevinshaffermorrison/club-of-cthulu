import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureGuestSession(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const response = await fetch("/api/auth/guest", { method: "POST" });
  const body = (await response.json()) as {
    error?: string;
    session?: { access_token: string; refresh_token: string };
  };
  if (!response.ok) {
    throw new Error(body.error ?? "Guest sign-in failed");
  }
  if (body.session) {
    const { error } = await supabase.auth.setSession(body.session);
    if (error) throw error;
  }
}
