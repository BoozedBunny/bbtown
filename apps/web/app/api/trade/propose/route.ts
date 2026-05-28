import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter, isUnauthorizedError } from "@/lib/auth";
import { createTradeProposal } from "@/lib/bff/tradeService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const body = await request.json();
    const { receiverUsername, offeredCredits, requestedCredits, offeredItems, requestedItems } = body;

    const result = await createTradeProposal(
      user.username,
      receiverUsername,
      Number(offeredCredits ?? 0),
      Number(requestedCredits ?? 0),
      offeredItems ?? [],
      requestedItems ?? []
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/trade/propose failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
