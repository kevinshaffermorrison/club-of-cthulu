"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEITIES, DEITY_META, type Deity } from "@/game";
import { ensureGuestSession } from "@/lib/auth/ensure-session";
import { createBrowserSupabase, supabaseConfigured } from "@/lib/supabase/client";

export function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [scoring, setScoring] = useState<Deity>("cthulhu");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = supabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    const supabase = createBrowserSupabase();
    void ensureGuestSession(supabase).catch(() => {
      // Surface on submit instead of a silent boot failure.
    });
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
      const { data, error: rpcError } = await supabase.rpc("create_room", {
        p_password: password,
        p_display_name: name,
        p_scoring_deity: scoring,
        p_max_players: maxPlayers,
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
      const { data, error: rpcError } = await supabase.rpc("join_room", {
        p_code: code,
        p_password: password,
        p_display_name: name,
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
    const supabase = createBrowserSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12">
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

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <form className="ritual-panel rounded-md p-5" onSubmit={onCreate}>
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
          <label className="mt-3 block text-xs uppercase tracking-wider text-[#9a917c]">
            Scoring color
            <select
              className="mt-1 w-full rounded-sm border border-[#3a3324] bg-[#0c100d] px-3 py-2 text-base text-[#e6dcc4]"
              value={scoring}
              onChange={(event) => setScoring(event.target.value as Deity)}
            >
              {DEITIES.map((deity) => (
                <option key={deity} value={deity}>
                  {DEITY_META[deity].short}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 flex gap-2">
            {DEITIES.map((deity) => (
              <button
                key={deity}
                type="button"
                onClick={() => setScoring(deity)}
                className={`token ${scoring === deity ? "ring-2 ring-[#e6dcc4]" : ""}`}
                style={{ background: DEITY_META[deity].color }}
                title={DEITY_META[deity].short}
                aria-label={DEITY_META[deity].short}
              />
            ))}
          </div>
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

      <button
        type="button"
        onClick={() => void google()}
        disabled={!configured}
        className="mx-auto mt-8 text-sm text-[#9a917c] underline decoration-[#3a3324] underline-offset-4 disabled:opacity-40"
      >
        Optional: continue with Google
      </button>
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
