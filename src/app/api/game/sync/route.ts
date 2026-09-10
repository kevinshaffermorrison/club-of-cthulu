import { NextResponse } from "next/server";
import { requireUser, syncPrivateView } from "@/server/game-service";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { roomId: string };
    const result = await syncPrivateView(body.roomId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
