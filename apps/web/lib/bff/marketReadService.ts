import { strapiFetchList } from "@/lib/cms/strapi";

type StrapiStock = {
  id: number;
  documentId?: string;
  symbol?: string;
  name?: string;
  price?: number | string;
  previousPrice?: number | string;
  updatedAt?: string;
  sector?: string;
  exchange?: string;
  marketCapBand?: "SMALL" | "MID" | "LARGE";
  volatilityClass?: "LOW" | "MEDIUM" | "HIGH";
  description?: string;
  hqRegion?: string;
  displayOrder?: number | string;
};

type StrapiStockHistory = {
  id: number;
  documentId?: string;
  price?: number | string;
  timestamp?: string;
};

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function enrichStockMetadata<T extends { symbol: string }>(stock: T) {
  return {
    ...stock,
    sector: (stock as any).sector ?? "General",
    exchange: (stock as any).exchange ?? "BBX",
    marketCapBand: (stock as any).marketCapBand ?? "MID",
    volatilityClass: (stock as any).volatilityClass ?? "MEDIUM",
    description: (stock as any).description ?? "Fictional listed company in the BBTown market.",
    hqRegion: (stock as any).hqRegion ?? "Central District",
    displayOrder: Number((stock as any).displayOrder ?? 999),
  };
}

function mapStrapiStock(row: StrapiStock) {
  return enrichStockMetadata({
    id: row.documentId ?? String(row.id),
    symbol: row.symbol ?? "",
    name: row.name ?? "",
    price: asNumber(row.price),
    previousPrice: asNumber(row.previousPrice),
    updatedAt: row.updatedAt ?? new Date(0).toISOString(),
    sector: row.sector,
    exchange: row.exchange,
    marketCapBand: row.marketCapBand,
    volatilityClass: row.volatilityClass,
    description: row.description,
    hqRegion: row.hqRegion,
    displayOrder: asNumber(row.displayOrder),
  });
}

async function listStocksFromStrapi() {
  const response = await strapiFetchList<StrapiStock>(
    "/api/stocks?pagination[limit]=500&sort=symbol:asc",
  );

  return (response.data ?? []).map(mapStrapiStock).filter((stock) => stock.symbol);
}

async function getStockWithRecentHistoryFromStrapi(symbol: string, historyLimit = 50) {
  const [stockResponse, historyResponse] = await Promise.all([
    strapiFetchList<StrapiStock>(
      `/api/stocks?filters[symbol][$eq]=${encodeURIComponent(symbol)}&pagination[limit]=1`,
    ),
    strapiFetchList<StrapiStockHistory>(
      `/api/stock-histories?filters[stock][symbol][$eq]=${encodeURIComponent(symbol)}&sort=timestamp:desc&pagination[limit]=${historyLimit}`,
    ),
  ]);

  const stock = stockResponse.data?.[0];
  if (!stock) return null;

  const mappedStock = mapStrapiStock(stock);
  const history = (historyResponse.data ?? []).map((row) => ({
    id: row.documentId ?? String(row.id),
    stockId: mappedStock.id,
    price: asNumber(row.price),
    timestamp: row.timestamp ?? new Date(0).toISOString(),
  }));

  return { ...mappedStock, history };
}

export async function listStocks() {
  const stocks = await listStocksFromStrapi();
  return stocks;
}

export async function getStockWithRecentHistory(symbol: string, historyLimit = 50) {
  return getStockWithRecentHistoryFromStrapi(symbol, historyLimit);
}
