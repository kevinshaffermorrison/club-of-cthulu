import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicSupabaseKey, publicSupabaseUrl } from "./env";

export async function createServerSupabase() {
  const url = publicSupabaseUrl();
  const key = publicSupabaseKey();
  if (!url || !key) {
    throw new Error("Missing Supabase public env");
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component; proxy refreshes the session.
        }
      },
    },
  });
}
