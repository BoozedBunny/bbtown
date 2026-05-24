import { NextResponse } from "next/server";
import { ensureLegacyCharacterForSession, getSessionUser } from "@/lib/auth";
import { getLoanState } from "@/lib/treasury/loanService";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user?.character) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const legacyCharacterId = await ensureLegacyCharacterForSession(user);
    const loan = await getLoanState(legacyCharacterId);
    return NextResponse.json({ loan });
  } catch (error) {
    console.error("GET /api/loans/me failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
