import { NextResponse } from "next/server";
import { getCompanyProfile } from "@/lib/market/companyProfiles";
import { getCompanyProfileFromCms } from "@/lib/cms/companyProfiles";
import { listStocks } from "@/lib/bff/marketReadService";

export async function GET() {
  try {
    const stocks = await listStocks();

    const enriched = await Promise.all(stocks.map(async (stock) => {
      const changeAbs = stock.price - stock.previousPrice;
      const changePct = stock.previousPrice > 0 ? (changeAbs / stock.previousPrice) * 100 : 0;
      const cmsProfile = await getCompanyProfileFromCms(stock.symbol);
      const profile = cmsProfile ?? getCompanyProfile(stock.symbol);

      return {
        ...stock,
        sector: profile?.sector ?? "General",
        exchange: profile?.exchange ?? "BBX",
        marketCapBand: profile?.marketCapBand ?? "MID",
        changeAbs,
        changePct,
        trend: changeAbs > 0 ? "UP" : changeAbs < 0 ? "DOWN" : "FLAT",
      };
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch stocks" }, { status: 500 });
  }
}
