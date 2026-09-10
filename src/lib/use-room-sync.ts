"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { PlayerRow, RoomRow } from "@/server/game-service";
import type { PublicGameState } from "@/game";

export type RealtimeStatus = "connecting" | "live" | "error";

type GameRow = {
  public_state?: PublicGameState;
  updated_at?: string;
  room_id?: string;
};

export function applyPlayerChange(
  players: PlayerRow[],
  event: "INSERT" | "UPDATE" | "DELETE" | "*",
  row: PlayerRow | undefined,
  previousId?: string,
): PlayerRow[] {
  if (event === "DELETE") {
    const id = row?.id ?? previousId;
    if (!id) return players;
    return players.filter((player) => player.id !== id);
  }
  if (!row) return players;
  const index = players.findIndex((player) => player.id === row.id);
  if (index < 0) {
    return [...players, row].sort((a, b) => a.seat_index - b.seat_index);
  }
  const next = [...players];
  next[index] = row;
  return next;
}

export function useRoomSync({
  roomId,
  userId,
  displayName,
  onRoom,
  onPlayers,
  onGame,
  enabled,
}: {
  roomId: string | null;
  userId: string | null;
  displayName: string;
  onRoom: (room: RoomRow) => void;
  onPlayers: (
    event: "INSERT" | "UPDATE" | "DELETE" | "*",
    row: PlayerRow | undefined,
    previousId?: string,
  ) => void;
  onGame: (state: PublicGameState, updatedAt: string) => void;
  enabled: boolean;
}): { status: RealtimeStatus; onlineUserIds: string[] } {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const onRoomRef = useRef(onRoom);
  const onPlayersRef = useRef(onPlayers);
  const onGameRef = useRef(onGame);
  onRoomRef.current = onRoom;
  onPlayersRef.current = onPlayers;
  onGameRef.current = onGame;

  useEffect(() => {
    if (!enabled || !roomId || !userId) {
      setStatus("connecting");
      setOnlineUserIds([]);
      return;
    }

    let cancelled = false;
    let supabase: ReturnType<typeof createBrowserSupabase>;
    try {
      supabase = createBrowserSupabase();
    } catch {
      setStatus("error");
      return;
    }

    setStatus("connecting");
    const channel = supabase
      .channel(`circle:${roomId}`, {
        config: { presence: { key: userId } },
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as RoomRow | undefined;
          if (row?.id) onRoomRef.current(row);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const event = payload.eventType as "INSERT" | "UPDATE" | "DELETE" | "*";
          const row = (payload.new ?? payload.old) as PlayerRow | undefined;
          const previousId = (payload.old as { id?: string } | undefined)?.id;
          onPlayersRef.current(event, row, previousId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as GameRow | undefined;
          if (!row?.public_state) return;
          onGameRef.current(row.public_state, row.updated_at ?? new Date().toISOString());
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId?: string }>();
        const ids = new Set<string>(Object.keys(state));
        for (const presences of Object.values(state)) {
          for (const presence of presences) {
            if (presence.userId) ids.add(presence.userId);
          }
        }
        if (!cancelled) setOnlineUserIds([...ids]);
      });

    channel.subscribe(async (nextStatus) => {
      if (cancelled) return;
      if (nextStatus === "SUBSCRIBED") {
        setStatus("live");
        await channel.track({ userId, name: displayName });
        return;
      }
      if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") {
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [enabled, roomId, userId, displayName]);

  return { status, onlineUserIds };
}
