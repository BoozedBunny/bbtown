import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter } from "@/lib/auth";
import { getPlayerInbox, getUnreadMailCount } from "@/lib/bff/mailService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const messages = await getPlayerInbox(user.username);
    const unreadCount = await getUnreadMailCount(user.username);
    return NextResponse.json({ messages, unreadCount });
  } catch (error: any) {
    console.error("Failed to fetch mailbox:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch mailbox" }, { status: 500 });
  }
}
