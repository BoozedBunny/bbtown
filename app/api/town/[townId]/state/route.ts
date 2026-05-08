import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

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

    const buildingStates = await prisma.buildingState.findMany({
      where: {
        townId: townId,
      },
      include: {
        owner: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
    });

    const town = await prisma.town.findUnique({
      where: { id: parseInt(townId) },
    });

    return NextResponse.json({
      buildings: buildingStates,
      town: town,
    });
  } catch (error) {
    console.error("Error fetching town state:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
