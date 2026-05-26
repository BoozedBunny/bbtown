import { NextResponse } from "next/server";
import { isUnauthorizedError, requireSessionUserWithCharacter } from "@/lib/auth";
import { getLoanState } from "@/lib/treasury/loanService";

export async function GET() {
  try {
    const user = await requireSessionUserWithCharacter();
    const loan = await getLoanState(user.character.id);
    return NextResponse.json({ loan });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/loans/me failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
