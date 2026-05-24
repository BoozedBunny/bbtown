import { many, oneOrNull } from "@/lib/db";

export async function listStocks() {
  return many(
    'SELECT "id", "symbol", "name", "price", "previousPrice", "updatedAt" FROM "Stock" ORDER BY "symbol" ASC',
  );
}

export async function getStockWithRecentHistory(symbol: string, historyLimit = 50) {
  const stock = await oneOrNull<{
    id: string;
    symbol: string;
    name: string;
    price: number;
    previousPrice: number;
    updatedAt: string;
  }>(
    'SELECT "id", "symbol", "name", "price", "previousPrice", "updatedAt" FROM "Stock" WHERE "symbol" = $1 LIMIT 1',
    [symbol],
  );

  if (!stock) return null;

  const history = await many(
    'SELECT "id", "stockId", "price", "timestamp" FROM "StockHistory" WHERE "stockId" = $1 ORDER BY "timestamp" DESC LIMIT $2',
    [stock.id, historyLimit],
  );

  return { ...stock, history };
}
