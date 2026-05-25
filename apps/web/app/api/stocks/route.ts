import { NextResponse } from "next/server";
import { listStocks } from "@/lib/bff/marketReadService";

export async function GET() {
  try {
    const stocks = await listStocks();

    const enriched = stocks.map((stock) => {
      const changeAbs = stock.price - stock.previousPrice;
      const changePct = stock.previousPrice > 0 ? (changeAbs / stock.previousPrice) * 100 : 0;

      return {
        ...stock,
        changeAbs,
        changePct,
        trend: changeAbs > 0 ? "UP" : changeAbs < 0 ? "DOWN" : "FLAT",
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch stocks" }, { status: 500 });
  }
}
