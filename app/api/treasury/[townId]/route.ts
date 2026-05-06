import { NextRequest, NextResponse } from "next/server";
import { getTreasurySummary } from "@/lib/treasury/treasuryService";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ townId: string }> }) {
  try {
    const { townId } = await params;
    const data = await getTreasurySummary(Number.parseInt(townId, 10));
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/treasury failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
