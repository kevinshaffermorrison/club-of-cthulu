import { createClient } from "npm:@supabase/supabase-js@2";
import {
  applyAction,
  toPublicState,
  type GameAction,
  type GameState,
} from "../../../src/game/engine.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
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

    const body = (await req.json()) as {
      roomId: string;
      playerId: string;
      action: GameAction;
    };
    const admin = createClient(url, service);
    const { data: game } = await admin
      .from("games")
      .select("id")
      .eq("room_id", body.roomId)
      .single();
    if (!game) throw new Error("No active ritual");
    const { data: secret } = await admin
      .from("game_secrets")
      .select("state")
      .eq("game_id", game.id)
      .single();
    if (!secret) throw new Error("Secret state missing");
    const state = secret.state as GameState;
    const actor = state.players.find((player) => player.id === body.playerId);
    if (!actor || actor.controllerUserId !== user.id) {
      throw new Error("You do not control that researcher");
    }
    const result = applyAction(state, body.action, body.playerId);
    const publicState = toPublicState(result.state);
    await admin
      .from("game_secrets")
      .update({ state: result.state })
      .eq("game_id", game.id);
    await admin
      .from("games")
      .update({ public_state: publicState, updated_at: new Date().toISOString() })
      .eq("id", game.id);
    if (result.state.phase === "game_over") {
      await admin.from("rooms").update({ status: "finished" }).eq("id", body.roomId);
    }
    return new Response(JSON.stringify({ publicState, privateView: result.privateView }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Act failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
