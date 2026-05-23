import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/market/companyProfiles";

export async function GET() {
  try {
    const stocks = await prisma.stock.findMany({
      orderBy: { symbol: "asc" },
    });

    const enriched = stocks.map((stock) => {
      const changeAbs = stock.price - stock.previousPrice;
      const changePct = stock.previousPrice > 0 ? (changeAbs / stock.previousPrice) * 100 : 0;
      const profile = getCompanyProfile(stock.symbol);

      return {
        ...stock,
        sector: profile?.sector ?? "General",
        exchange: profile?.exchange ?? "BBX",
        marketCapBand: profile?.marketCapBand ?? "MID",
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
