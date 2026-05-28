import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter } from "@/lib/auth";
import { getPlayerProfileAndInventory } from "@/lib/bff/inventoryService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const inventoryData = await getPlayerProfileAndInventory(user.username);
    return NextResponse.json(inventoryData);
  } catch (error: any) {
    console.error("Inventory fetch error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch inventory" }, { status: 500 });
  }
}
