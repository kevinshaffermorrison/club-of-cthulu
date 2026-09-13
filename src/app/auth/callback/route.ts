import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicSupabaseKey, publicSupabaseUrl } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") ? nextParam : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}${next}?auth_error=missing_code`);
  }

  const url = publicSupabaseUrl();
  const key = publicSupabaseKey();
  if (!url || !key) {
    return NextResponse.redirect(`${origin}${next}?auth_error=missing_supabase`);
  }

  const cookieStore = await cookies();
  const pending: {
    name: string;
    value: string;
    options: Parameters<typeof cookieStore.set>[2];
  }[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          pending.push({ name, value, options });
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const destination = error
    ? `${origin}${next}?auth_error=${encodeURIComponent(error.message)}`
    : `${origin}${next}`;
  const response = NextResponse.redirect(destination);
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
