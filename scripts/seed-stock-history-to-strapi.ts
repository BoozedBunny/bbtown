import { Client } from "pg";

type DbHistory = {
  id: string;
  symbol: string;
  price: number;
  timestamp: string;
};

type StrapiStock = {
  id: number;
  documentId?: string;
  symbol?: string;
};

type StrapiHistory = {
  id: number;
  documentId?: string;
};

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const token = process.env.STRAPI_API_TOKEN;
const historyLimitPerStock = Number(process.env.SEED_STOCK_HISTORY_LIMIT ?? 250);

if (!databaseUrl) {
  console.error("Missing DATABASE_URL env var.");
  process.exit(1);
}

if (!token) {
  console.error("Missing STRAPI_API_TOKEN env var.");
  process.exit(1);
}

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

async function fetchStocks(): Promise<StrapiStock[]> {
  const url = new URL(`${baseUrl}/api/stocks`);
  url.searchParams.set("pagination[pageSize]", "500");
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query Strapi stocks (${res.status})`);
  const json = (await res.json()) as { data?: StrapiStock[] };
  return json.data ?? [];
}

async function fetchHistoryByStockAndTimestamp(symbol: string, timestamp: string): Promise<StrapiHistory | null> {
  const url = new URL(`${baseUrl}/api/stock-histories`);
  url.searchParams.set("filters[stock][symbol][$eq]", symbol);
  url.searchParams.set("filters[timestamp][$eq]", timestamp);
  url.searchParams.set("pagination[limit]", "1");
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query stock history (${res.status})`);
  const json = (await res.json()) as { data?: StrapiHistory[] };
  return json.data?.[0] ?? null;
}

async function createHistory(stockIdentifier: string, price: number, timestamp: string) {
  const res = await fetch(`${baseUrl}/api/stock-histories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        stock: stockIdentifier,
        price,
        timestamp,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create stock history failed (${res.status}): ${text}`);
  }
}

async function main() {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  try {
    const stocks = await fetchStocks();
    const stockBySymbol = new Map(stocks.filter((s) => s.symbol).map((s) => [String(s.symbol), s]));

    let created = 0;
    let skipped = 0;

    for (const [symbol, stock] of stockBySymbol.entries()) {
      const identifier = stock.documentId ?? String(stock.id);
      const result = await db.query<DbHistory>(
        'SELECT h."id", s."symbol", h."price", h."timestamp"::text AS "timestamp" FROM "StockHistory" h JOIN "Stock" s ON s."id" = h."stockId" WHERE s."symbol" = $1 ORDER BY h."timestamp" DESC LIMIT $2',
        [symbol, historyLimitPerStock],
      );

      for (const row of result.rows) {
        const existing = await fetchHistoryByStockAndTimestamp(symbol, row.timestamp);
        if (existing) {
          skipped += 1;
          continue;
        }
        await createHistory(identifier, row.price, row.timestamp);
        created += 1;
      }

      console.log(`processed ${symbol}: rows=${result.rowCount}`);
    }

    console.log(`done: created=${created} skipped=${skipped}`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
