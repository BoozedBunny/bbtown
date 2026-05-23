import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureLegacyCharacterForSession, getSessionUser } from "@/lib/auth";
import { issueLoan } from "@/lib/treasury/loanService";
import { AUTH_COOKIE_NAME, updatePlayerProfile } from "@/lib/strapiAuth";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user?.character) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const legacyCharacterId = await ensureLegacyCharacterForSession(user);
    const result = await issueLoan(legacyCharacterId, body.quote, body.quoteHash, body.idempotencyKey);

    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
    if (token && !result?.error && typeof result?.walletAfter === "number") {
      try {
        await updatePlayerProfile(token, Number(user.id), {
          wallet: result.walletAfter,
          loanStatus: "ACTIVE",
        });
      } catch (syncError) {
        console.error("Loan issue Strapi profile sync failed", syncError);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/loans/issue failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
