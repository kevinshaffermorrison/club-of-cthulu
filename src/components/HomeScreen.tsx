"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEITIES, type Deity } from "@/game";
import { ensureGuestSession, googleAvatarUrl, isGuestUser } from "@/lib/auth/ensure-session";
import { createBrowserSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { ScoringStrategyPicker } from "./ScoringCard";
import { YourCircles, type CircleSummary } from "./YourCircles";

export function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [scoring, setScoring] = useState<Deity | "random">("random");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [guest, setGuest] = useState(true);
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const configured = supabaseConfigured();

  async function loadAccount() {
    const supabase = createBrowserSupabase();
    await ensureGuestSession(supabase);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setUserId(user?.id ?? null);
    const signedInAsGuest = isGuestUser(user);
    setGuest(signedInAsGuest);
    const fullName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user?.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null;
    setAccountLabel(fullName ?? user?.email ?? null);
    if (!signedInAsGuest && fullName) {
      setName((current) => current || fullName);
    }
    const { data } = await supabase
      .from("rooms")
      .select(
            "id, code, status, scoring_deity, created_at, players(display_name, controller_user_id, avatar_url)",
      )
      .order("created_at", { ascending: false })
      .limit(12);
    setCircles((data as CircleSummary[] | null) ?? []);
  }

  useEffect(() => {
    if (!configured) return;
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      setError(authError);
      window.history.replaceState({}, "", window.location.pathname);
    }
    void loadAccount().catch(() => {
      // Surface on submit instead of a silent boot failure.
    });
    // Bootstrap once when Supabase env is present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  async function ensureSession() {
    const supabase = createBrowserSupabase();
    await ensureGuestSession(supabase);
    return supabase;
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = await ensureSession();
      const { data: userData } = await supabase.auth.getUser();
      const { data, error: rpcError } = await supabase.rpc("create_room", {
        p_password: password,
        p_display_name: name,
        p_scoring_deity:
          scoring === "random"
            ? DEITIES[Math.floor(Math.random() * DEITIES.length)]
            : scoring,
        p_max_players: maxPlayers,
        p_avatar_url: googleAvatarUrl(userData.user),
      });
      if (rpcError) throw rpcError;
      const roomCode = data?.room?.code as string;
      router.push(`/room/${roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open a circle");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = await ensureSession();
      const { data: userData } = await supabase.auth.getUser();
      const { data, error: rpcError } = await supabase.rpc("join_room", {
        p_code: code,
        p_password: password,
        p_display_name: name,
        p_avatar_url: googleAvatarUrl(userData.user),
      });
      if (rpcError) throw rpcError;
      const roomCode = (data?.room?.code as string) ?? code.toUpperCase();
      router.push(`/room/${roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (!configured) return;
    setError(null);
    const supabase = createBrowserSupabase();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) setError(oauthError.message);
  }

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    await loadAccount();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-12">
      <p className="text-center text-xs uppercase tracking-[0.4em] text-[#c9a227]">
        Play With Us · 2025
      </p>
      <h1 className="mt-3 text-center font-[family-name:var(--font-display)] text-5xl leading-tight">
        Club of Cthulhu
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-center text-[#9a917c]">
        Burn manuscripts on the ritual star. Local seats can share a device;
        remote researchers join the same private circle. Buried decks never leave
        the server.
      </p>

      {!configured ? (
        <p className="ritual-panel mt-8 rounded-md p-4 text-sm text-[#c43c3c]">
          Add your Supabase URL and publishable key to `.env.local`. Game actions
          also need the secret key. Enable Anonymous sign-ins in Auth, then run
          the SQL migration on the hosted project.
        </p>
      ) : null}

      {configured ? <YourCircles circles={circles} userId={userId} /> : null}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <form className="ritual-panel min-w-0 rounded-md p-5" onSubmit={onCreate}>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            Open a circle
          </h2>
          <Field label="Your name" value={name} onChange={setName} required />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            required
          />
          <ScoringStrategyPicker value={scoring} onChange={setScoring} />
          <label className="mt-3 block text-xs uppercase tracking-wider text-[#9a917c]">
            Seats
            <select
              className="mt-1 w-full rounded-sm border border-[#3a3324] bg-[#0c100d] px-3 py-2 text-base text-[#e6dcc4]"
              value={maxPlayers}
              onChange={(event) => setMaxPlayers(Number(event.target.value))}
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} researchers
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !configured}
            className="mt-4 w-full rounded-sm bg-[#c9a227] py-2 font-semibold text-[#14110b] disabled:opacity-40"
          >
            Create private room
          </button>
        </form>

        <form className="ritual-panel rounded-md p-5" onSubmit={onJoin}>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            Enter a circle
          </h2>
          <Field label="Your name" value={name} onChange={setName} required />
          <Field label="Room code" value={code} onChange={setCode} required />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            required
          />
          <button
            disabled={busy || !configured}
            className="mt-4 w-full rounded-sm border border-[#c9a227] py-2 text-[#c9a227] disabled:opacity-40"
          >
            Join
          </button>
        </form>
      </div>

      <div className="mx-auto mt-8 flex flex-col items-center gap-2 text-sm text-[#9a917c]">
        {guest ? (
          <button
            type="button"
            onClick={() => void google()}
            disabled={!configured}
            className="underline decoration-[#3a3324] underline-offset-4 disabled:opacity-40"
          >
            Optional: continue with Google
          </button>
        ) : (
          <>
            <p>
              Signed in with Google
              {accountLabel ? ` as ${accountLabel}` : ""}
            </p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="underline decoration-[#3a3324] underline-offset-4"
            >
              Sign out
            </button>
          </>
        )}
      </div>
      {error ? (
        <p className="mt-4 text-center text-sm text-[#c43c3c]">{error}</p>
      ) : null}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="mt-3 block text-xs uppercase tracking-wider text-[#9a917c]">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-sm border border-[#3a3324] bg-[#0c100d] px-3 py-2 text-base text-[#e6dcc4]"
      />
    </label>
  );
}
