import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/market/companyProfiles";

export async function GET() {
  try {
    const stocks = await prisma.stock.findMany({ orderBy: { symbol: "asc" } });

    const tickerRows = stocks
      .map((stock) => {
        const profile = getCompanyProfile(stock.symbol);
        const changeAbs = stock.price - stock.previousPrice;
        const changePct = stock.previousPrice > 0 ? (changeAbs / stock.previousPrice) * 100 : 0;
        return {
          symbol: stock.symbol,
          price: stock.price,
          changePct,
          trend: changeAbs > 0 ? "UP" : changeAbs < 0 ? "DOWN" : "FLAT",
          displayOrder: profile?.displayOrder ?? 999,
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder || a.symbol.localeCompare(b.symbol));

    return NextResponse.json(
      tickerRows.map(({ displayOrder, ...row }) => row),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch market ticker" }, { status: 500 });
  }
}
