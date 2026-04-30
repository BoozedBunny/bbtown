import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const stocks = await prisma.stock.findMany({
      orderBy: { symbol: 'asc' }
    });
    return NextResponse.json(stocks);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch stocks" }, { status: 500 });
  }
}
