import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter, isUnauthorizedError } from "@/lib/auth";
import { getPlayerTradeProposals } from "@/lib/bff/tradeService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const result = await getPlayerTradeProposals(user.username);
    return NextResponse.json(result);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/trade/list failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
