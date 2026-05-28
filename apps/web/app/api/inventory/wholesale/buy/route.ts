import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter } from "@/lib/auth";
import { buyWholesaleItem } from "@/lib/bff/inventoryService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const body = await request.json();
    
    const { itemKey, quantity } = body;
    
    if (!itemKey || quantity === undefined) {
      return NextResponse.json({ error: "Missing required parameters: itemKey, quantity" }, { status: 400 });
    }
    
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });
    }
    
    const result = await buyWholesaleItem(user.username, itemKey, qty);
    
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("Wholesale purchase error:", error);
    return NextResponse.json({ error: error.message || "Failed to make purchase" }, { status: 500 });
  }
}
