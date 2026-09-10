import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createServerSupabase();
    const { data: existing } = await supabase.auth.getUser();
    if (existing.user) {
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminSupabase();
    const email = `guest-${crypto.randomUUID()}@guests.clubofcthulhu.app`;
    const password = `${crypto.randomUUID()}Aa1!`;
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { guest: true },
    });
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      return NextResponse.json(
        { error: error?.message ?? "Could not start a guest session" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Guest sign-in failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
