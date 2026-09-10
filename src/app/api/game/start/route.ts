import { NextResponse } from "next/server";
import { requireUser, startGame } from "@/server/game-service";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { roomId: string };
    const result = await startGame(body.roomId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
