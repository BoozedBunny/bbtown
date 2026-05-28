import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter } from "@/lib/auth";
import { splitInventoryStack, getInventoryCapacity } from "@/lib/bff/inventoryService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const body = await request.json();
    
    const { fromSlot, toSlot, splitQuantity } = body;
    
    if (fromSlot === undefined || toSlot === undefined || splitQuantity === undefined) {
      return NextResponse.json({ error: "Missing required parameters: fromSlot, toSlot, splitQuantity" }, { status: 400 });
    }
    
    const profileDocId = user.character.id;
    const capacity = getInventoryCapacity(Number(user.character.experience ?? 0));
    
    const success = await splitInventoryStack(profileDocId, Number(fromSlot), Number(toSlot), Number(splitQuantity), capacity);
    
    return NextResponse.json({ ok: success });
  } catch (error: any) {
    console.error("Stack split error:", error);
    return NextResponse.json({ error: error.message || "Failed to split stack" }, { status: 500 });
  }
}
