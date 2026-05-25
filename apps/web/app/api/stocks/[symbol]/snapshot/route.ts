import { NextRequest, NextResponse } from "next/server";
import { getMarketNewsSnippets } from "@/lib/marketNews";
import { getStockWithRecentHistory } from "@/lib/bff/marketReadService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await params;
    const stock = await getStockWithRecentHistory(symbol, 50);

    if (!stock) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    const changeAbs = stock.price - stock.previousPrice;
    const changePct = stock.previousPrice > 0 ? (changeAbs / stock.previousPrice) * 100 : 0;
    const prices = [stock.price, ...stock.history.map((h) => h.price)];
    const dayHigh = Math.max(...prices);
    const dayLow = Math.min(...prices);

    return NextResponse.json({
      quote: {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        previousPrice: stock.previousPrice,
        changeAbs,
        changePct,
        trend: changeAbs > 0 ? "UP" : changeAbs < 0 ? "DOWN" : "FLAT",
      },
      profile: {
        sector: stock.sector,
        exchange: stock.exchange,
        marketCapBand: stock.marketCapBand,
        volatilityClass: stock.volatilityClass,
        description: stock.description,
        hqRegion: stock.hqRegion,
      },
      stats: {
        dayHigh,
        dayLow,
        dayRangePct: dayLow > 0 ? ((dayHigh - dayLow) / dayLow) * 100 : 0,
        lastUpdatedAt: stock.updatedAt,
      },
      news: getMarketNewsSnippets({ symbol: stock.symbol, sector: stock.sector, changePct }),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch stock snapshot" }, { status: 500 });
  }
}
