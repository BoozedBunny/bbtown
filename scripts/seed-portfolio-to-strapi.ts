import { Client } from "pg";

type DbPortfolioRow = {
  portfolioId: string;
  username: string;
  stockSymbol: string;
  quantity: number;
};

type StrapiPlayerProfile = {
  id: number;
  documentId?: string;
  authUserId?: number;
  displayName?: string;
};

type StrapiStock = {
  id: number;
  documentId?: string;
  symbol?: string;
};

type StrapiPortfolioItem = {
  id: number;
  documentId?: string;
  quantity?: number;
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

async function fetchProfiles(): Promise<StrapiPlayerProfile[]> {
  const url = new URL(`${baseUrl}/api/player-profiles`);
  url.searchParams.set("fields[0]", "authUserId");
  url.searchParams.set("fields[1]", "displayName");
  url.searchParams.set("pagination[pageSize]", "500");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query player-profiles (${res.status})`);
  const json = (await res.json()) as { data?: StrapiPlayerProfile[] };
  return json.data ?? [];
}

async function fetchStocks(): Promise<StrapiStock[]> {
  const url = new URL(`${baseUrl}/api/stocks`);
  url.searchParams.set("fields[0]", "symbol");
  url.searchParams.set("pagination[pageSize]", "500");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query stocks (${res.status})`);
  const json = (await res.json()) as { data?: StrapiStock[] };
  return json.data ?? [];
}

async function fetchPortfolioItem(authUserId: number, stockSymbol: string): Promise<StrapiPortfolioItem | null> {
  const url = new URL(`${baseUrl}/api/portfolio-items`);
  url.searchParams.set("filters[playerProfile][authUserId][$eq]", String(authUserId));
  url.searchParams.set("filters[stock][symbol][$eq]", stockSymbol);
  url.searchParams.set("pagination[limit]", "1");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query portfolio-items (${res.status})`);
  const json = (await res.json()) as { data?: StrapiPortfolioItem[] };
  return json.data?.[0] ?? null;
}

async function createPortfolioItem(playerProfileIdentifier: string, stockIdentifier: string, quantity: number) {
  const res = await fetch(`${baseUrl}/api/portfolio-items`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        playerProfile: playerProfileIdentifier,
        stock: stockIdentifier,
        quantity,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create portfolio-item failed (${res.status}): ${text}`);
  }
}

async function updatePortfolioItem(identifier: string, quantity: number) {
  const res = await fetch(`${baseUrl}/api/portfolio-items/${identifier}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { quantity } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update portfolio-item failed (${res.status}): ${text}`);
  }
}

async function main() {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  try {
    const [profiles, stocks, portfolioRows] = await Promise.all([
      fetchProfiles(),
      fetchStocks(),
      db.query<DbPortfolioRow>(
        `SELECT p."id" AS "portfolioId", u."username" AS "username", s."symbol" AS "stockSymbol", p."quantity" AS "quantity"
         FROM "PortfolioItem" p
         JOIN "Character" c ON c."id" = p."characterId"
         JOIN "User" u ON u."id" = c."userId"
         JOIN "Stock" s ON s."id" = p."stockId"
         ORDER BY u."username" ASC, s."symbol" ASC`,
      ),
    ]);

    const profileByDisplayName = new Map(
      profiles
        .filter((p) => p.displayName && (p.documentId || p.id) && Number.isFinite(Number(p.authUserId)))
        .map((p) => [String(p.displayName), p]),
    );

    const stockBySymbol = new Map(
      stocks
        .filter((s) => s.symbol && (s.documentId || s.id))
        .map((s) => [String(s.symbol), s]),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of portfolioRows.rows) {
      const profile = profileByDisplayName.get(row.username);
      if (!profile || !Number.isFinite(Number(profile.authUserId))) {
        skipped += 1;
        console.warn(`skip ${row.username}/${row.stockSymbol}: no matching player-profile by displayName`);
        continue;
      }

      const stock = stockBySymbol.get(row.stockSymbol);
      if (!stock) {
        skipped += 1;
        console.warn(`skip ${row.username}/${row.stockSymbol}: no matching stock in Strapi`);
        continue;
      }

      const authUserId = Number(profile.authUserId);
      const existing = await fetchPortfolioItem(authUserId, row.stockSymbol);

      if (!existing) {
        await createPortfolioItem(profile.documentId ?? String(profile.id), stock.documentId ?? String(stock.id), row.quantity);
        created += 1;
        continue;
      }

      await updatePortfolioItem(existing.documentId ?? String(existing.id), row.quantity);
      updated += 1;
    }

    console.log(`done: created=${created} updated=${updated} skipped=${skipped} dbRows=${portfolioRows.rowCount}`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
