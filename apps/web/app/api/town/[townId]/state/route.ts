import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTownStateById } from "@/lib/bff/gameReadService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ townId: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user || !user.character) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { townId } = await params;

    const { buildings, town } = await getTownStateById(townId);

    return NextResponse.json({
      buildings,
      town,
    });
  } catch (error) {
    console.error("Error fetching town state:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
