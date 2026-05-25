import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureLegacyCharacterForSession, isUnauthorizedError, requireSessionUserWithCharacter } from "@/lib/auth";
import { repayLoan } from "@/lib/treasury/loanService";
import { AUTH_COOKIE_NAME, updatePlayerProfile } from "@/lib/strapiAuth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const body = await request.json();
    const legacyCharacterId = await ensureLegacyCharacterForSession(user);
    const result = await repayLoan(legacyCharacterId, body.loanId, Number(body.amount), body.idempotencyKey);

    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
    if (token && !result?.error && typeof result?.walletAfter === "number") {
      try {
        const remainingPrincipal = Number(result?.remaining?.principal ?? NaN);
        const remainingFees = Number(result?.remaining?.fees ?? NaN);
        const loanClosed = Number.isFinite(remainingPrincipal) && Number.isFinite(remainingFees)
          ? remainingPrincipal <= 0 && remainingFees <= 0
          : false;

        await updatePlayerProfile(token, Number(user.id), {
          wallet: result.walletAfter,
          loanStatus: loanClosed ? "NONE" : "ACTIVE",
        });
      } catch (syncError) {
        console.error("Loan repay Strapi profile sync failed", syncError);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/loans/repay failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
