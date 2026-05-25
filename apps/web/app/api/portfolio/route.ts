import { NextResponse } from "next/server";
import { ensureLegacyCharacterForSession, isUnauthorizedError, requireSessionUserWithCharacter } from "@/lib/auth";
import { getPortfolioForCharacter } from "@/lib/bff/gameReadService";

export async function GET() {
  try {
    const user = await requireSessionUserWithCharacter();

    const legacyCharacterId = await ensureLegacyCharacterForSession(user);

    const portfolio = await getPortfolioForCharacter(legacyCharacterId, user.id, user.username);

    return NextResponse.json(portfolio);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}
