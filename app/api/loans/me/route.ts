import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getLoanState } from "@/lib/treasury/loanService";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user?.character) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const loan = await getLoanState(user.character.id);
    return NextResponse.json({ loan });
  } catch (error) {
    console.error("GET /api/loans/me failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
