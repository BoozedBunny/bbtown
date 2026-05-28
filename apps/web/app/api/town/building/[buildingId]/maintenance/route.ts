import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter } from "@/lib/auth";
import { getPlayerProfileAndInventory } from "@/lib/bff/inventoryService";
import { MAINTENANCE_CONFIG } from "@/lib/bff/maintenanceService";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildingId: string }> }
) {
  try {
    const { buildingId } = await params;
    const user = await requireSessionUserWithCharacter();
    const { slots } = await getPlayerProfileAndInventory(user.username);
    
    // Query building state by buildingId and townId (if present in query)
    const { searchParams } = new URL(request.url);
    const townId = searchParams.get("townId");
    
    const headers = {
      "Content-Type": "application/json",
      ...(process.env.STRAPI_API_TOKEN ? { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}` } : {}),
    };
    
    const url = new URL(`${STRAPI_BASE_URL}/api/building-states`);
    if (townId) {
      url.searchParams.set("filters[stateId][$eq]", `${townId}:${buildingId}`);
    } else {
      url.searchParams.set("filters[stateId][$endsWith]", `:${buildingId}`);
    }
    url.searchParams.set("pagination[limit]", "1");
    
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch building state");
    const payload = await res.json();
    const building = payload.data?.[0];
    if (!building) throw new Error("Building state not found");
    
    const level = Number(building.buildingLevel ?? 0);
    const config = MAINTENANCE_CONFIG[level] || MAINTENANCE_CONFIG[0];
    
    // Count items in stock
    const stock: Record<string, number> = {};
    for (const slot of slots) {
      if (slot.item?.key) {
        stock[slot.item.key] = (stock[slot.item.key] || 0) + slot.quantity;
      }
    }
    
    const checklist = Object.entries(config.items).map(([key, required]) => {
      const inStock = stock[key] || 0;
      return {
        key,
        required,
        inStock,
        satisfied: inStock >= required,
      };
    });
    
    return NextResponse.json({
      level,
      income: config.income,
      checklist,
      lastSweptDateKey: building.lastSweptDateKey || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch maintenance checklist" }, { status: 500 });
  }
}
