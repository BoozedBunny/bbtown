import { NextRequest, NextResponse } from "next/server";
import { isUnauthorizedError, requireSessionUserWithCharacter } from "@/lib/auth";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";

const UPGRADE_COSTS: Record<number, number> = {
  1: 5000,
  2: 10000,
  3: 25000,
  4: 50000,
  5: 100000,
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const token = process.env.STRAPI_API_TOKEN;
    if (!token) {
      throw new Error("Missing STRAPI_API_TOKEN");
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Find the stock owned by this user
    const stockUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
    stockUrl.searchParams.set("filters[owner][documentId][$eq]", user.character.id);
    stockUrl.searchParams.set("pagination[limit]", "1");

    const stockRes = await fetch(stockUrl.toString(), { headers, cache: "no-store" });
    if (!stockRes.ok) {
      throw new Error(`Stock fetch failed: ${stockRes.statusText}`);
    }
    const stockData = await stockRes.json();
    const ownedStock = stockData.data?.[0];

    if (!ownedStock) {
      return NextResponse.json({ error: "You do not own a stock/brand to upgrade" }, { status: 400 });
    }

    const currentLevel = Number(ownedStock.level ?? 1);
    if (currentLevel >= 6) {
      return NextResponse.json({ error: "Stock is already at maximum level" }, { status: 400 });
    }

    const cost = UPGRADE_COSTS[currentLevel];
    if (typeof cost !== "number") {
      return NextResponse.json({ error: "Invalid stock level upgrade path" }, { status: 400 });
    }

    // Retrieve latest player profile to ensure fresh wallet balance
    const profileUrl = `${STRAPI_BASE_URL}/api/player-profiles/${user.character.id}`;
    const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
    if (!profileRes.ok) {
      throw new Error(`Profile fetch failed: ${profileRes.statusText}`);
    }
    const profilePayload = await profileRes.json();
    const profileData = profilePayload.data;
    const currentWallet = Number(profileData.wallet ?? 0);

    if (currentWallet < cost) {
      return NextResponse.json({ error: `Insufficient funds. Upgrade costs ${cost} credits, but you have ${currentWallet}.` }, { status: 400 });
    }

    // Deduct upgrade cost
    const nextWallet = currentWallet - cost;
    const profileUpdateRes = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${user.character.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        data: {
          wallet: nextWallet,
        },
      }),
      cache: "no-store",
    });

    if (!profileUpdateRes.ok) {
      throw new Error(`Wallet deduction failed: ${profileUpdateRes.statusText}`);
    }

    // Increment stock level
    const nextLevel = currentLevel + 1;
    const stockId = ownedStock.documentId ?? String(ownedStock.id);
    const stockUpdateRes = await fetch(`${STRAPI_BASE_URL}/api/stocks/${stockId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        data: {
          level: nextLevel,
        },
      }),
      cache: "no-store",
    });

    if (!stockUpdateRes.ok) {
      throw new Error(`Stock level upgrade failed: ${stockUpdateRes.statusText}`);
    }

    return NextResponse.json({
      success: true,
      symbol: ownedStock.symbol,
      name: ownedStock.name,
      oldLevel: currentLevel,
      newLevel: nextLevel,
      cost,
      newWallet: nextWallet,
      message: `Successfully upgraded brand ${ownedStock.symbol} to Level ${nextLevel}!`,
    });

  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/stocks/upgrade failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
