import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const stock = await prisma.stock.findUnique({
      where: { symbol },
      include: {
        history: {
          orderBy: { timestamp: 'desc' },
          take: 50
        }
      }
    });

    if (stock) {
      stock.history.reverse();
    }

    if (!stock) return NextResponse.json({ error: "Stock not found" }, { status: 404 });

    return NextResponse.json(stock.history);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
