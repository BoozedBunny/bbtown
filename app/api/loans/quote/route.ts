import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createLoanQuote } from "@/lib/treasury/loanService";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user?.character) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const requestedPrincipal = Number(body?.requestedPrincipal ?? 0);
    const response = await createLoanQuote(user.character.id, requestedPrincipal);
    return NextResponse.json(response);
  } catch (error) {
    console.error("POST /api/loans/quote failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
