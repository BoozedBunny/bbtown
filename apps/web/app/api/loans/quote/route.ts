import { NextRequest, NextResponse } from "next/server";
import { ensureLegacyCharacterForSession, isUnauthorizedError, requireSessionUserWithCharacter } from "@/lib/auth";
import { createLoanQuote } from "@/lib/treasury/loanService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const body = await request.json();
    const requestedPrincipal = Number(body?.requestedPrincipal ?? 0);
    const legacyCharacterId = await ensureLegacyCharacterForSession(user);
    const response = await createLoanQuote(legacyCharacterId, requestedPrincipal);
    return NextResponse.json(response);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/loans/quote failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
