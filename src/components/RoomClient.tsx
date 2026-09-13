"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameBoard } from "@/components/GameBoard";
import { HomeLink } from "@/components/HomeLink";
import { Lobby } from "@/components/Lobby";
import {
  applyOptimistic,
  type GameAction,
  type PrivateView,
  type PublicGameState,
} from "@/game";
import { ensureGuestSession, googleAvatarUrl } from "@/lib/auth/ensure-session";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { applyPlayerChange, useRoomSync } from "@/lib/use-room-sync";
import type { PlayerRow, RoomRow } from "@/server/game-service";

function needsPeek(state: PublicGameState | null) {
  const kind = state?.pending?.kind;
  return kind === "telepathy" || kind === "memory_pick" || kind === "memory_place";
}

function peekIsOurs(state: PublicGameState, userId: string) {
  if (!needsPeek(state)) return false;
  const actor = state.players.find((player) => player.id === state.pending?.actorPlayerId);
  return actor?.controllerUserId === userId;
}

export function RoomClient({ code }: { code: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [game, setGame] = useState<PublicGameState | null>(null);
  const [privateView, setPrivateView] = useState<PrivateView>({});
  const [error, setError] = useState<string | null>(null);
  const inflightActs = useRef(0);
  const roomIdRef = useRef<string | null>(null);
  const gameRef = useRef<PublicGameState | null>(null);
  const actChain = useRef(Promise.resolve());
  const lastGameAt = useRef(0);
  const pendingRemote = useRef<{ state: PublicGameState; ts: number } | null>(null);
  const userIdRef = useRef<string | null>(null);
  roomIdRef.current = room?.id ?? null;
  userIdRef.current = userId;
  if (inflightActs.current === 0) {
    gameRef.current = game;
  }

  const refreshPrivate = useCallback(async (roomId: string) => {
    const response = await fetch("/api/game/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    });
    const body = await response.json();
    const views = body.views as { playerId: string; privateView: PrivateView }[] | undefined;
    const peek = views?.find((view) => view.privateView.peekedCards?.length);
    setPrivateView(peek?.privateView ?? {});
  }, []);

  const applyGame = useCallback(
    (state: PublicGameState, updatedAt?: string) => {
      const ts = updatedAt ? Date.parse(updatedAt) : Date.now();
      if (ts && ts < lastGameAt.current) return;
      lastGameAt.current = ts || lastGameAt.current;
      gameRef.current = state;
      setGame(state);
      const uid = userIdRef.current;
      const roomId = roomIdRef.current;
      if (uid && roomId && peekIsOurs(state, uid)) void refreshPrivate(roomId);
      else if (!needsPeek(state)) setPrivateView({});
    },
    [refreshPrivate],
  );

  const load = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      await ensureGuestSession(supabase);
    }
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      setUserId(userData.user.id);
      const avatar = googleAvatarUrl(userData.user);
      if (avatar) {
        await supabase.rpc("set_my_avatar", { p_avatar_url: avatar });
      }
    }

    const { data: roomRow, error: roomError } = await supabase
      .from("rooms")
      .select("id, code, scoring_deity, max_players, host_user_id, status")
      .eq("code", code.toUpperCase())
      .single();
    if (roomError || !roomRow) {
      setError(roomError?.message ?? "Room not found");
      return;
    }
    setRoom(roomRow as RoomRow);
    const { data: seatRows } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomRow.id)
      .order("seat_index");
    setPlayers((seatRows as PlayerRow[]) ?? []);
    const { data: gameRow } = await supabase
      .from("games")
      .select("public_state, updated_at")
      .eq("room_id", roomRow.id)
      .maybeSingle();
    if (gameRow?.public_state) {
      lastGameAt.current = gameRow.updated_at ? Date.parse(gameRow.updated_at) : Date.now();
      const publicState = gameRow.public_state as PublicGameState;
      gameRef.current = publicState;
      setGame(publicState);
      if (userData.user && peekIsOurs(publicState, userData.user.id)) {
        await refreshPrivate(roomRow.id);
      }
    }
  }, [code, refreshPrivate]);

  useEffect(() => {
    let cancelled = false;
    void load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const displayName =
    players.find((player) => player.controller_user_id === userId)?.display_name ?? "researcher";

  const { status: realtimeStatus, onlineUserIds } = useRoomSync({
    roomId: room?.id ?? null,
    userId,
    displayName,
    enabled: Boolean(room?.id && userId),
    onRoom: (next) => {
      setRoom((current) =>
        current
          ? {
              ...current,
              status: next.status,
              max_players: next.max_players,
              scoring_deity: next.scoring_deity,
              host_user_id: next.host_user_id,
              code: next.code,
            }
          : next,
      );
    },
    onPlayers: (event, row, previousId) => {
      setPlayers((current) => applyPlayerChange(current, event, row, previousId));
    },
    onGame: (state, updatedAt) => {
      const ts = Date.parse(updatedAt) || Date.now();
      if (inflightActs.current > 0) {
        pendingRemote.current = { state, ts };
        return;
      }
      applyGame(state, updatedAt);
    },
  });

  async function act(playerId: string, action: GameAction) {
    const roomId = roomIdRef.current;
    const current = gameRef.current;
    if (!roomId || !current) return;
    setError(null);
    const previous = current;
    const optimistic = applyOptimistic(current, playerId, action);
    if (optimistic) {
      gameRef.current = optimistic;
      setGame(optimistic);
    }
    inflightActs.current += 1;
    const run = async () => {
      try {
        const response = await fetch("/api/game/act", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, playerId, action }),
        });
        const body = await response.json();
        if (!response.ok) {
          gameRef.current = previous;
          setGame(previous);
          setError(body.error ?? "Action failed");
          return;
        }
        const publicState = body.publicState as PublicGameState;
        const ts = body.updatedAt ? Date.parse(body.updatedAt) : Date.now();
        lastGameAt.current = ts;
        gameRef.current = publicState;
        setGame(publicState);
        setPrivateView(body.privateView ?? {});
      } catch {
        gameRef.current = previous;
        setGame(previous);
        setError("Action failed");
      } finally {
        inflightActs.current -= 1;
        if (inflightActs.current === 0 && pendingRemote.current) {
          const queued = pendingRemote.current;
          pendingRemote.current = null;
          if (queued.ts >= lastGameAt.current) {
            applyGame(queued.state, new Date(queued.ts).toISOString());
          }
        }
      }
    };
    const queued = actChain.current.then(run, run);
    actChain.current = queued.then(
      () => undefined,
      () => undefined,
    );
    await queued;
  }

  async function start() {
    if (!room) return;
    const response = await fetch("/api/game/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Could not start");
      return;
    }
    lastGameAt.current = body.updatedAt ? Date.parse(body.updatedAt) : Date.now();
    setGame(body.publicState as PublicGameState);
    gameRef.current = body.publicState as PublicGameState;
    setRoom((current) => (current ? { ...current, status: "playing" } : current));
  }

  if (!userId || !room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <HomeLink />
        <p className="text-center text-[#9a917c]">{error ?? "Approaching the circle…"}</p>
      </div>
    );
  }

  if (!game || room.status === "lobby") {
    return (
      <Lobby
        room={room}
        players={players}
        userId={userId}
        error={error}
        realtimeStatus={realtimeStatus}
        onlineUserIds={onlineUserIds}
        onReady={async (playerId, ready) => {
          const supabase = createBrowserSupabase();
          const { error: rpcError } = await supabase.rpc("set_ready", {
            p_player_id: playerId,
            p_ready: ready,
          });
          if (rpcError) setError(rpcError.message);
        }}
        onAddLocal={async (name) => {
          const supabase = createBrowserSupabase();
          const { data: userData } = await supabase.auth.getUser();
          const { error: rpcError } = await supabase.rpc("add_local_seat", {
            p_room_id: room.id,
            p_display_name: name,
            p_avatar_url: googleAvatarUrl(userData.user),
          });
          if (rpcError) setError(rpcError.message);
        }}
        onStart={() => void start()}
      />
    );
  }

  const gameWithAvatars = game
    ? {
        ...game,
        players: game.players.map((player) => ({
          ...player,
          avatarUrl:
            player.avatarUrl ??
            players.find((seat) => seat.id === player.id)?.avatar_url ??
            null,
        })),
      }
    : null;

  return (
    <>
      {error ? (
        <p className="bg-[#8f2d2d]/40 px-4 py-2 text-center text-sm">{error}</p>
      ) : null}
      <GameBoard
        game={gameWithAvatars!}
        userId={userId}
        privateView={privateView}
        realtimeStatus={realtimeStatus}
        onlineUserIds={onlineUserIds}
        onAct={act}
      />
    </>
  );
}
