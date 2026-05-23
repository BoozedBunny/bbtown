import { NextRequest, NextResponse } from "next/server";
import { getStockWithRecentHistory } from "@/lib/bff/marketReadService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const stock = await getStockWithRecentHistory(symbol, 50);

    if (stock) {
      stock.history.reverse();
    }

    if (!stock) return NextResponse.json({ error: "Stock not found" }, { status: 404 });

    return NextResponse.json(stock.history);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
