import { prisma } from "@/lib/prisma";

export async function listStocks() {
  return prisma.stock.findMany({ orderBy: { symbol: "asc" } });
}

export async function getStockWithRecentHistory(symbol: string, historyLimit = 50) {
  return prisma.stock.findUnique({
    where: { symbol },
    include: {
      history: {
        orderBy: { timestamp: "desc" },
        take: historyLimit,
      },
    },
  });
}
