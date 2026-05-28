import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter, isUnauthorizedError } from "@/lib/auth";
import { resolveTradeProposal } from "@/lib/bff/tradeService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  try {
    const user = await requireSessionUserWithCharacter();
    const { proposalId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !["ACCEPT", "REJECT", "CANCEL"].includes(action)) {
      return NextResponse.json({ error: "Invalid resolution action." }, { status: 400 });
    }

    const result = await resolveTradeProposal(proposalId, user.username, action);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/trade/[proposalId]/resolve failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
