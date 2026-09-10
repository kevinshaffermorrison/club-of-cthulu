import { NextResponse } from "next/server";
import { actOnGame, requireUser } from "@/server/game-service";
import type { GameAction } from "@/game";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      roomId: string;
      playerId: string;
      action: GameAction;
    };
    const result = await actOnGame(
      body.roomId,
      user.id,
      body.playerId,
      body.action,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Act failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
