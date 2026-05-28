import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter } from "@/lib/auth";
import { markMailAsRead, deleteMailMessage } from "@/lib/bff/mailService";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    await requireSessionUserWithCharacter();
    const { messageId } = await params;
    
    const success = await markMailAsRead(messageId);
    if (!success) throw new Error("Failed to mark mail as read");
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to read mail:", error);
    return NextResponse.json({ error: error.message || "Failed to read mail" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    await requireSessionUserWithCharacter();
    const { messageId } = await params;
    
    const success = await deleteMailMessage(messageId);
    if (!success) throw new Error("Failed to delete mail message");
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete mail:", error);
    return NextResponse.json({ error: error.message || "Failed to delete mail" }, { status: 500 });
  }
}
