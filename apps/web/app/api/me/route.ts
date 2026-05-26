import { NextResponse } from "next/server";
import { isUnauthorizedError, requireSessionUserWithCharacter } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await requireSessionUserWithCharacter();

    return NextResponse.json({
      username: user.username,
      wallet: user.character.wallet,
      characterId: user.character.id,
      avatar: user.character.avatar,
      description: user.character.description,
      arenaMaxRounds: user.character.arenaMaxRounds,
      experience: user.character.experience,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch user state" },
      { status: 500 },
    );
  }
}
