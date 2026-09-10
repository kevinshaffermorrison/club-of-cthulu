"use client";

import { useState } from "react";
import { DEITIES, DEITY_META, type Deity } from "@/game";
import type { PlayerRow, RoomRow } from "@/server/game-service";

export function Lobby({
  room,
  players,
  userId,
  onReady,
  onAddLocal,
  onStart,
  error,
  realtimeStatus = "connecting",
  onlineUserIds = [],
}: {
  room: RoomRow;
  players: PlayerRow[];
  userId: string;
  onReady: (playerId: string, ready: boolean) => void;
  onAddLocal: (name: string) => void;
  onStart: () => void;
  error?: string | null;
  realtimeStatus?: "connecting" | "live" | "error";
  onlineUserIds?: string[];
}) {
  const [localName, setLocalName] = useState("");
  const mine = players.filter((p) => p.controller_user_id === userId);
  const isHost = room.host_user_id === userId;
  const allReady = players.length >= 2 && players.every((p) => p.is_ready);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <p className="text-center text-xs uppercase tracking-[0.35em] text-[#c9a227]">
        Private circle
      </p>
      <h1 className="mt-2 text-center font-[family-name:var(--font-display)] text-4xl">
        {room.code}
      </h1>
      <p className="mt-2 text-center text-sm text-[#9a917c]">
        Scoring color: {DEITY_META[room.scoring_deity as Deity]?.short}
        {" · "}
        {realtimeStatus === "live"
          ? "Live"
          : realtimeStatus === "error"
            ? "Reconnect the circle"
            : "Linking…"}
      </p>
      <p className="mt-1 text-center text-xs text-[#9a917c]">
        Share code <span className="text-[#e6dcc4]">{room.code}</span> and the password so
        others can join from another device.
      </p>
      <div className="gold-rule my-6" />
      <ul className="space-y-3">
        {players.map((player) => (
          <li
            key={player.id}
            className="ritual-panel flex items-center justify-between rounded-md px-4 py-3"
          >
            <div>
              <p className="font-[family-name:var(--font-display)]">
                {player.display_name}
              </p>
              <p className="text-xs uppercase tracking-wider text-[#9a917c]">
                Seat {player.seat_index + 1}
                {player.controller_user_id === userId ? " · this device" : ""}
                {onlineUserIds.includes(player.controller_user_id) ? " · online" : ""}
              </p>
            </div>
            {player.controller_user_id === userId ? (
              <button
                type="button"
                onClick={() => onReady(player.id, !player.is_ready)}
                className={`rounded-sm px-3 py-1 text-xs uppercase tracking-wider ${
                  player.is_ready
                    ? "bg-[#2f8f5b] text-[#07150e]"
                    : "bg-[#c9a227] text-[#14110b]"
                }`}
              >
                {player.is_ready ? "Ready" : "I'm ready"}
              </button>
            ) : (
              <span className="text-xs uppercase text-[#9a917c]">
                {player.is_ready ? "Ready" : "Waiting"}
              </span>
            )}
          </li>
        ))}
      </ul>

      {isHost && players.length < room.max_players ? (
        <form
          className="mt-6 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!localName.trim()) return;
            onAddLocal(localName.trim());
            setLocalName("");
          }}
        >
          <input
            value={localName}
            onChange={(event) => setLocalName(event.target.value)}
            placeholder="Add local researcher"
            className="flex-1 rounded-sm border border-[#3a3324] bg-[#0c100d] px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-sm border border-[#c9a227] px-3 py-2 text-sm text-[#c9a227]"
          >
            Add seat
          </button>
        </form>
      ) : null}

      {isHost ? (
        <button
          type="button"
          disabled={!allReady}
          onClick={onStart}
          className="mt-6 rounded-sm bg-[#c9a227] px-4 py-3 font-[family-name:var(--font-display)] tracking-[0.2em] uppercase text-[#14110b] disabled:opacity-40"
        >
          Begin the ritual
        </button>
      ) : (
        <p className="mt-6 text-center text-sm text-[#9a917c]">
          Waiting for the host. Your seats: {mine.map((p) => p.display_name).join(", ")}
        </p>
      )}
      {error ? <p className="mt-3 text-center text-sm text-[#c43c3c]">{error}</p> : null}
      <p className="mt-8 text-center text-[0.7rem] uppercase tracking-[0.2em] text-[#9a917c]">
        {DEITIES.length} colors · {room.max_players} seats
      </p>
    </div>
  );
}
