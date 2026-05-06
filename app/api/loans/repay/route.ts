import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { repayLoan } from "@/lib/treasury/loanService";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user?.character) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const result = await repayLoan(user.character.id, body.loanId, Number(body.amount), body.idempotencyKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/loans/repay failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
