import { NextResponse } from "next/server";
import { ensureLegacyCharacterForSession, getSessionUser } from "@/lib/auth";
import { getPortfolioForCharacter } from "@/lib/bff/gameReadService";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || !user.character) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const legacyCharacterId = await ensureLegacyCharacterForSession(user);

    const portfolio = await getPortfolioForCharacter(legacyCharacterId);

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}
