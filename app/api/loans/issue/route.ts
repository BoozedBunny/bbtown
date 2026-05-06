import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { issueLoan } from "@/lib/treasury/loanService";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user?.character) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const result = await issueLoan(user.character.id, body.quote, body.quoteHash, body.idempotencyKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/loans/issue failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
