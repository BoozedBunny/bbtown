import { Client } from "pg";

type DbStock = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  previousPrice: number;
  updatedAt: string;
};

type StockProfileSeed = {
  sector: string;
  exchange: string;
  marketCapBand: "SMALL" | "MID" | "LARGE";
  volatilityClass: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  hqRegion: string;
  displayOrder: number;
};

const STOCK_PROFILE_SEED: Record<string, StockProfileSeed> = {
  BANA: { sector: "Consumer", exchange: "BBX", marketCapBand: "MID", volatilityClass: "MEDIUM", description: "Fictional consumer staples supplier known for resilient snack demand and stable contracts.", hqRegion: "Harbor District", displayOrder: 1 },
  STON: { sector: "Industrial", exchange: "BBX", marketCapBand: "LARGE", volatilityClass: "MEDIUM", description: "Freight routing and warehousing network operator powering inter-town distribution lanes.", hqRegion: "North Yard", displayOrder: 2 },
  DOGE: { sector: "Finance", exchange: "BBX", marketCapBand: "SMALL", volatilityClass: "HIGH", description: "Digital settlement rails provider focused on low-fee merchant payments.", hqRegion: "Old Exchange", displayOrder: 3 },
  TEAR: { sector: "Healthcare", exchange: "BBX", marketCapBand: "MID", volatilityClass: "LOW", description: "Fictional health product research brand with recurring subscription revenue.", hqRegion: "East Gardens", displayOrder: 4 },
  COPE: { sector: "Tech", exchange: "BBX", marketCapBand: "LARGE", volatilityClass: "HIGH", description: "Cloud infrastructure and developer tooling platform serving BBTown enterprises.", hqRegion: "Skyline Ring", displayOrder: 5 },
  LOLA: { sector: "Consumer", exchange: "BBX", marketCapBand: "MID", volatilityClass: "MEDIUM", description: "Regional liquor retail chain with high-margin private labels and busy nightlife storefronts.", hqRegion: "Lantern Row", displayOrder: 6 },
  UBI: { sector: "Media", exchange: "BBX", marketCapBand: "SMALL", volatilityClass: "HIGH", description: "Indie-to-blockbuster film production studio monetizing streaming rights and franchise IP.", hqRegion: "Studio Quarter", displayOrder: 7 },
  BB: { sector: "Internet", exchange: "BBX", marketCapBand: "SMALL", volatilityClass: "MEDIUM", description: "Web community platform operator focused on creator tools, discussion hubs, and fan economies.", hqRegion: "Forum Heights", displayOrder: 8 },
};

function getStockProfileSeed(symbol: string): StockProfileSeed {
  return (
    STOCK_PROFILE_SEED[symbol] ?? {
      sector: "General",
      exchange: "BBX",
      marketCapBand: "MID",
      volatilityClass: "MEDIUM",
      description: "Fictional listed company in the BBTown market.",
      hqRegion: "Central District",
      displayOrder: 999,
    }
  );
}

type StrapiStock = {
  id: number;
  documentId?: string;
  symbol?: string;
};

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const token = process.env.STRAPI_API_TOKEN;

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

async function fetchOneStockBySymbol(symbol: string): Promise<StrapiStock | null> {
  const url = new URL(`${baseUrl}/api/stocks`);
  url.searchParams.set("filters[symbol][$eq]", symbol);
  url.searchParams.set("pagination[limit]", "1");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query stocks (${res.status})`);
  const json = (await res.json()) as { data?: StrapiStock[] };
  return json.data?.[0] ?? null;
}

async function createStock(stock: DbStock) {
  const profile = getStockProfileSeed(stock.symbol);
  const res = await fetch(`${baseUrl}/api/stocks`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        previousPrice: stock.previousPrice,
        sector: profile.sector,
        exchange: profile.exchange,
        marketCapBand: profile.marketCapBand,
        volatilityClass: profile.volatilityClass,
        description: profile.description,
        hqRegion: profile.hqRegion,
        displayOrder: profile.displayOrder,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create stock ${stock.symbol} failed (${res.status}): ${text}`);
  }
}

async function updateStock(identifier: string, stock: DbStock) {
  const profile = getStockProfileSeed(stock.symbol);
  const res = await fetch(`${baseUrl}/api/stocks/${identifier}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      data: {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        previousPrice: stock.previousPrice,
        sector: profile.sector,
        exchange: profile.exchange,
        marketCapBand: profile.marketCapBand,
        volatilityClass: profile.volatilityClass,
        description: profile.description,
        hqRegion: profile.hqRegion,
        displayOrder: profile.displayOrder,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update stock ${stock.symbol} failed (${res.status}): ${text}`);
  }
}

async function main() {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  try {
    const result = await db.query<DbStock>(
      'SELECT "id", "symbol", "name", "price", "previousPrice", "updatedAt" FROM "Stock" ORDER BY "symbol" ASC',
    );

    let created = 0;
    let updated = 0;

    for (const stock of result.rows) {
      const existing = await fetchOneStockBySymbol(stock.symbol);
      if (!existing) {
        await createStock(stock);
        created += 1;
        console.log(`created stock ${stock.symbol}`);
      } else {
        const identifier = existing.documentId ?? String(existing.id);
        await updateStock(identifier, stock);
        updated += 1;
        console.log(`updated stock ${stock.symbol}`);
      }
    }

    console.log(`done: created=${created} updated=${updated}`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
