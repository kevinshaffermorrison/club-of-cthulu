import type { SupabaseClient, User } from "@supabase/supabase-js";

export function isGuestUser(user: User | null | undefined) {
  if (!user) return true;
  return (
    user.user_metadata?.guest === true ||
    Boolean(user.email?.endsWith("@guests.clubofcthulhu.app"))
  );
}

export function googleAvatarUrl(user: User | null | undefined): string | null {
  const meta = user?.user_metadata ?? {};
  const raw = meta.avatar_url ?? meta.picture;
  if (typeof raw !== "string" || !raw.startsWith("https://")) return null;
  return raw;
}

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
