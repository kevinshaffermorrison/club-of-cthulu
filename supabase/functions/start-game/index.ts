import { createClient } from "npm:@supabase/supabase-js@2";
import { createGame, toPublicState } from "../../../src/game/engine.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) throw new Error("Sign in first");
    const { roomId } = (await req.json()) as { roomId: string };
    const admin = createClient(url, service);
    const { data: room } = await admin.from("rooms").select("*").eq("id", roomId).single();
    if (!room) throw new Error("Unknown room");
    if (room.host_user_id !== user.id) throw new Error("Only the host can begin");
    if (room.status !== "lobby") throw new Error("Already begun");
    const { data: players } = await admin
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("seat_index");
    if (!players || players.length < 2) throw new Error("Need at least two researchers");
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
        avatarUrl: player.avatar_url ?? null,
      })),
    });
    await admin.from("games").insert({
      id: state.id,
      room_id: roomId,
      public_state: toPublicState(state),
    });
    await admin.from("game_secrets").insert({ game_id: state.id, state });
    await admin.from("rooms").update({ status: "playing" }).eq("id", roomId);
    return new Response(JSON.stringify({ publicState: toPublicState(state) }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
