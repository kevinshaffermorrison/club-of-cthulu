import {
  applyAction,
  createGame,
  privateViewFor,
  toPublicState,
  type GameAction,
  type GameState,
} from "@/game";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type RoomRow = {
  id: string;
  code: string;
  scoring_deity: string;
  max_players: number;
  host_user_id: string;
  status: "lobby" | "playing" | "finished";
};

export type PlayerRow = {
  id: string;
  room_id: string;
  seat_index: number;
  display_name: string;
  controller_user_id: string;
  is_ready: boolean;
};

export async function requireUser() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Sign in first");
  }
  return data.user;
}

export async function startGame(roomId: string, userId: string) {
  const admin = createAdminSupabase();
  const { data: room, error: roomError } = await admin
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();
  if (roomError || !room) throw new Error("Unknown room");
  if (room.host_user_id !== userId) throw new Error("Only the host can begin");
  if (room.status !== "lobby") throw new Error("Already begun");

  const { data: players, error: playerError } = await admin
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("seat_index");
  if (playerError || !players) throw new Error("Could not load seats");
  if (players.length < 2) throw new Error("Need at least two researchers");
  if (players.some((player) => !player.is_ready)) {
    throw new Error("Every researcher must be ready");
  }

  const state = createGame({
    id: crypto.randomUUID(),
    scoringDeity: room.scoring_deity,
    players: players.map((player) => ({
      id: player.id,
      displayName: player.display_name,
      controllerUserId: player.controller_user_id,
    })),
  });

  const { error: gameError } = await admin.from("games").insert({
    id: state.id,
    room_id: roomId,
    public_state: toPublicState(state),
  });
  if (gameError) throw new Error(gameError.message);

  const { error: secretError } = await admin.from("game_secrets").insert({
    game_id: state.id,
    state,
  });
  if (secretError) throw new Error(secretError.message);

  await admin.from("rooms").update({ status: "playing" }).eq("id", roomId);
  return { publicState: toPublicState(state), updatedAt: new Date().toISOString() };
}

export async function actOnGame(
  roomId: string,
  userId: string,
  playerId: string,
  action: GameAction,
) {
  const admin = createAdminSupabase();
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("id, room_id")
    .eq("room_id", roomId)
    .single();
  if (gameError || !game) throw new Error("No active ritual");

  const { data: secret, error: secretError } = await admin
    .from("game_secrets")
    .select("state")
    .eq("game_id", game.id)
    .single();
  if (secretError || !secret) throw new Error("Secret state missing");

  const state = secret.state as GameState;
  const actor = state.players.find((player) => player.id === playerId);
  if (!actor) throw new Error("Unknown seat");
  if (actor.controllerUserId !== userId) {
    throw new Error("You do not control that researcher");
  }

  const result = applyAction(state, action, playerId);
  const next = result.state;
  const publicState = toPublicState(next);

  const { error: secretWrite } = await admin
    .from("game_secrets")
    .update({ state: next })
    .eq("game_id", game.id);
  if (secretWrite) throw new Error(secretWrite.message);

  const updatedAt = new Date().toISOString();
  const { error: publicWrite } = await admin
    .from("games")
    .update({
      public_state: publicState,
      updated_at: updatedAt,
    })
    .eq("id", game.id);
  if (publicWrite) throw new Error(publicWrite.message);

  if (next.phase === "game_over") {
    await admin.from("rooms").update({ status: "finished" }).eq("id", roomId);
  }

  return {
    publicState,
    privateView: result.privateView,
    updatedAt,
  };
}

export async function syncPrivateView(roomId: string, userId: string) {
  const admin = createAdminSupabase();
  const { data: game } = await admin
    .from("games")
    .select("id")
    .eq("room_id", roomId)
    .single();
  if (!game) return { privateView: {} };
  const { data: secret } = await admin
    .from("game_secrets")
    .select("state")
    .eq("game_id", game.id)
    .single();
  if (!secret) return { privateView: {} };
  const state = secret.state as GameState;
  const seats = state.players.filter((player) => player.controllerUserId === userId);
  const views = seats.map((seat) => ({
    playerId: seat.id,
    privateView: privateViewFor(state, seat.id),
  }));
  return { views };
}
