import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter } from "@/lib/auth";
import { getPlayerWalletSummary } from "@/lib/bff/ledgerService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const summary = await getPlayerWalletSummary(user.username);
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("Wallet summary error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch wallet summary" }, { status: 500 });
  }
}
