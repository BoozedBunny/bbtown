import { NextRequest, NextResponse } from "next/server";
import { isUnauthorizedError, requireSessionUserWithCharacter } from "@/lib/auth";
import { getLevelFromXP } from "@/lib/leveling";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const body = await request.json();
    
    let symbol = (body.symbol ?? "").toUpperCase().trim();
    const name = (body.name ?? "").trim();

    if (!symbol || !name) {
      return NextResponse.json({ error: "Symbol and Name are required" }, { status: 400 });
    }

    // Validate symbol format (3-5 uppercase letters)
    if (!/^[A-Z]{3,5}$/.test(symbol)) {
      return NextResponse.json({ error: "Symbol must be between 3 and 5 uppercase letters" }, { status: 400 });
    }

    // Validate player level >= 5
    const playerXP = Number(user.character.experience ?? 0);
    const playerLevel = getLevelFromXP(playerXP);
    if (playerLevel < 5) {
      return NextResponse.json({ error: "Player level 5 or higher is required to found a brand" }, { status: 400 });
    }

    const token = process.env.STRAPI_API_TOKEN;
    if (!token) {
      throw new Error("Missing STRAPI_API_TOKEN");
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Validate player does not already own a stock
    const ownerCheckUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
    ownerCheckUrl.searchParams.set("filters[owner][documentId][$eq]", user.character.id);
    ownerCheckUrl.searchParams.set("pagination[limit]", "1");

    const ownerCheckRes = await fetch(ownerCheckUrl.toString(), { headers, cache: "no-store" });
    if (!ownerCheckRes.ok) {
      throw new Error(`Owner check failed: ${ownerCheckRes.statusText}`);
    }
    const ownerCheckData = await ownerCheckRes.json();
    if (ownerCheckData.data && ownerCheckData.data.length > 0) {
      return NextResponse.json({ error: "You already own a stock/brand" }, { status: 400 });
    }

    // Validate symbol is unique in Strapi
    const symbolCheckUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
    symbolCheckUrl.searchParams.set("filters[symbol][$eq]", symbol);
    symbolCheckUrl.searchParams.set("pagination[limit]", "1");

    const symbolCheckRes = await fetch(symbolCheckUrl.toString(), { headers, cache: "no-store" });
    if (!symbolCheckRes.ok) {
      throw new Error(`Symbol check failed: ${symbolCheckRes.statusText}`);
    }
    const symbolCheckData = await symbolCheckRes.json();
    if (symbolCheckData.data && symbolCheckData.data.length > 0) {
      return NextResponse.json({ error: `Symbol '${symbol}' is already taken` }, { status: 400 });
    }

    // Create the new stock at Level 1, seeded at $10.00
    const createStockRes = await fetch(`${STRAPI_BASE_URL}/api/stocks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          symbol,
          name,
          price: 10.00,
          previousPrice: 10.00,
          owner: user.character.id,
          level: 1,
          sector: "Consumer Goods",
          exchange: "BBX",
          marketCapBand: "SMALL",
          volatilityClass: "MEDIUM",
          description: `Premium consumer brand founded by ${user.character.name}.`,
          hqRegion: "Central District",
          displayOrder: 100,
        },
      }),
      cache: "no-store",
    });

    if (!createStockRes.ok) {
      const errorText = await createStockRes.text();
      throw new Error(`Failed to create stock in Strapi: ${createStockRes.status} ${errorText}`);
    }

    const createdStockPayload = await createStockRes.json();
    const stockData = createdStockPayload.data;
    const stockId = stockData.documentId ?? String(stockData.id);

    // Seed 1,000 initial shares to the founder
    const createPortfolioRes = await fetch(`${STRAPI_BASE_URL}/api/portfolio-items`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          playerProfile: user.character.id,
          stock: stockId,
          quantity: 1000,
        },
      }),
      cache: "no-store",
    });

    if (!createPortfolioRes.ok) {
      const errorText = await createPortfolioRes.text();
      console.error(`Failed to seed portfolio items: ${errorText}`);
    }

    // Seed stock history with initial $10.00 entry
    const createHistoryRes = await fetch(`${STRAPI_BASE_URL}/api/stock-histories`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          stock: stockId,
          price: 10.00,
          timestamp: new Date().toISOString(),
        },
      }),
      cache: "no-store",
    });

    if (!createHistoryRes.ok) {
      const errorText = await createHistoryRes.text();
      console.error(`Failed to seed stock history: ${errorText}`);
    }

    return NextResponse.json({
      success: true,
      symbol,
      name,
      stockId,
      level: 1,
      message: `Successfully founded brand ${symbol}! Seeded 1,000 shares in your portfolio.`,
    });

  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/stocks/create failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
