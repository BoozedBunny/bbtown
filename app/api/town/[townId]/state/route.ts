import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ townId: string }> }
) {
  try {
    const { townId } = await params;

    const buildingStates = await prisma.buildingState.findMany({
      where: {
        townId: townId,
      },
      include: {
        owner: {
          select: {
            name: true,
          },
        },
      },
    });

    const town = await prisma.town.findUnique({
      where: { id: parseInt(townId) }
    });

    return NextResponse.json({
      buildings: buildingStates,
      town: town
    });
  } catch (error) {
    console.error('Error fetching town state:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}