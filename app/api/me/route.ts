import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || !user.character) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      username: user.name,
      wallet: user.character.wallet,
      characterId: user.character.id
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch user state" }, { status: 500 });
  }
}
