import { Client } from "pg";

type DbRow = {
  username: string;
  wallet: number;
  symbol: string;
  quantity: number;
};

type StrapiProfile = {
  id: number;
  documentId?: string;
  displayName?: string;
  wallet?: number;
};

type StrapiItem = {
  id: number;
  quantity?: number;
  stock?: { symbol?: string } | null;
};

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const token = process.env.STRAPI_API_TOKEN;

if (!databaseUrl || !token) {
  console.error("Missing DATABASE_URL or STRAPI_API_TOKEN env var.");
  process.exit(1);
}

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

async function fetchProfiles(): Promise<StrapiProfile[]> {
  const url = new URL(`${baseUrl}/api/player-profiles`);
  url.searchParams.set("fields[0]", "displayName");
  url.searchParams.set("fields[1]", "wallet");
  url.searchParams.set("pagination[pageSize]", "500");
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`profiles fetch failed (${res.status})`);
  const json = (await res.json()) as { data?: StrapiProfile[] };
  return json.data ?? [];
}

async function fetchPortfolioForUsername(username: string): Promise<Map<string, number>> {
  const url = new URL(`${baseUrl}/api/portfolio-items`);
  url.searchParams.set("filters[playerProfile][displayName][$eq]", username);
  url.searchParams.set("populate[stock][fields][0]", "symbol");
  url.searchParams.set("pagination[pageSize]", "500");
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`portfolio fetch failed for ${username} (${res.status})`);
  const json = (await res.json()) as { data?: StrapiItem[] };
  const map = new Map<string, number>();
  for (const item of json.data ?? []) {
    const symbol = item.stock?.symbol;
    if (!symbol) continue;
    map.set(symbol, Number(item.quantity ?? 0));
  }
  return map;
}

async function main() {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  try {
    const dbRes = await db.query<DbRow>(
      `SELECT u."username" as "username", c."wallet" as "wallet", s."symbol" as "symbol", p."quantity" as "quantity"
       FROM "PortfolioItem" p
       JOIN "Character" c ON c."id" = p."characterId"
       JOIN "User" u ON u."id" = c."userId"
       JOIN "Stock" s ON s."id" = p."stockId"
       ORDER BY u."username", s."symbol"`,
    );

    const dbByUser = new Map<string, { wallet: number; holdings: Map<string, number> }>();
    for (const row of dbRes.rows) {
      if (!dbByUser.has(row.username)) {
        dbByUser.set(row.username, { wallet: row.wallet, holdings: new Map() });
      }
      const bucket = dbByUser.get(row.username)!;
      bucket.wallet = row.wallet;
      bucket.holdings.set(row.symbol, row.quantity);
    }

    const profiles = await fetchProfiles();
    let mismatches = 0;

    for (const [username, dbState] of dbByUser.entries()) {
      const profile = profiles.find((p) => p.displayName === username);
      if (!profile) {
        console.log(`MISSING_PROFILE ${username}`);
        mismatches += 1;
        continue;
      }

      const strapiWallet = Number(profile.wallet ?? 0);
      if (strapiWallet !== dbState.wallet) {
        console.log(`WALLET_MISMATCH ${username} db=${dbState.wallet} strapi=${strapiWallet}`);
        mismatches += 1;
      }

      const strapiHoldings = await fetchPortfolioForUsername(username);

      for (const [symbol, dbQty] of dbState.holdings.entries()) {
        const strapiQty = Number(strapiHoldings.get(symbol) ?? 0);
        if (strapiQty !== dbQty) {
          console.log(`HOLDING_MISMATCH ${username} ${symbol} db=${dbQty} strapi=${strapiQty}`);
          mismatches += 1;
        }
      }
    }

    if (mismatches === 0) {
      console.log(`OK: market sync consistent for ${dbByUser.size} user(s)`);
      return;
    }

    console.log(`FAIL: ${mismatches} mismatch(es)`);
    process.exit(2);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
