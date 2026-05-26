import { strapiFetchList } from "@/lib/cms/strapi";
import { many, oneOrNull } from "@/lib/db";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";

function getStrapiServiceHeaders(): HeadersInit | null {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

type StrapiRelation<T> = {
  data?: T | null;
};

type StrapiTown = {
  id: number;
  townId?: number | string;
  name?: string;
  bankBalance?: number;
};

type StrapiOwnerProfile = {
  displayName?: string;
  avatar?: string;
};

type StrapiBuildingState = {
  stateId?: string;
  title?: string;
  forSale?: boolean;
  price?: number;
  employees?: number;
  owner?: StrapiRelation<StrapiOwnerProfile>;
  town?: StrapiRelation<StrapiTown>;
};

function normalizeTownId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function mapStrapiBuildingState(row: StrapiBuildingState, fallbackTownId: string) {
  const stateId = row.stateId ?? "";
  const buildingId = stateId.includes(":") ? stateId.split(":")[1] : stateId;

  return {
    id: buildingId || stateId,
    townId: fallbackTownId,
    title: row.title ?? "",
    forSale: Boolean(row.forSale),
    price: Number(row.price ?? 0),
    employees: Number(row.employees ?? 0),
    ownerId: null,
    owner: row.owner?.data
      ? {
          name: row.owner.data.displayName ?? null,
          avatar: row.owner.data.avatar ?? null,
        }
      : null,
  };
}

async function getTownStateFromStrapi(townId: string) {
  const [townResponse, buildingStatesResponse] = await Promise.all([
    strapiFetchList<StrapiTown>(
      `/api/towns?filters[townId][$eq]=${encodeURIComponent(townId)}&pagination[limit]=1`,
    ),
    strapiFetchList<StrapiBuildingState>(
      `/api/building-states?filters[town][townId][$eq]=${encodeURIComponent(townId)}&populate[owner][fields][0]=displayName&populate[owner][fields][1]=avatar&pagination[limit]=500`,
    ),
  ]);

  const townEntry = townResponse.data?.[0];
  if (!townEntry) {
    return null;
  }

  const normalizedTownId = normalizeTownId(townEntry.townId) ?? townId;
  const buildings = (buildingStatesResponse.data ?? []).map((row) => mapStrapiBuildingState(row, normalizedTownId));

  return {
    buildings,
    town: {
      id: normalizedTownId,
      name: townEntry.name ?? "",
      bankBalance: Number(townEntry.bankBalance ?? 0),
    },
  };
}

async function getTownStateFromDb(townId: string) {
  const [buildings, town] = await Promise.all([
    many(
      `SELECT
        b."id",
        b."townId",
        b."title",
        b."forSale",
        b."price",
        b."employees",
        b."ownerId",
        CASE WHEN c."id" IS NULL THEN NULL ELSE json_build_object('name', c."name", 'avatar', c."avatar") END AS "owner"
      FROM "BuildingState" b
      LEFT JOIN "Character" c ON c."id" = b."ownerId"
      WHERE b."townId" = $1`,
      [townId],
    ),
    oneOrNull('SELECT "id", "name", "bankBalance" FROM "Town" WHERE "id" = $1 LIMIT 1', [parseInt(townId, 10)]),
  ]);

  return { buildings, town };
}

type StrapiPortfolioStock = {
  id: number;
  documentId?: string;
  symbol?: string;
  name?: string;
  price?: number | string;
  previousPrice?: number | string;
  updatedAt?: string;
};

type StrapiPortfolioItem = {
  id: number;
  documentId?: string;
  quantity?: number | string;
  stock?: StrapiPortfolioStock | null;
};

async function getPortfolioFromStrapi(characterId: string, authUserId?: string, username?: string) {
  if (!authUserId && !username) return [];

  const authUserIdNumber = Number(authUserId);
  const hasNumericAuthUserId = Number.isFinite(authUserIdNumber);
  const profileFilter = hasNumericAuthUserId
    ? `filters[playerProfile][authUserId][$eq]=${authUserIdNumber}`
    : `filters[playerProfile][displayName][$eq]=${encodeURIComponent(username ?? "")}`;

  const response = await strapiFetchList<StrapiPortfolioItem>(
    `/api/portfolio-items?${profileFilter}&populate[stock][fields][0]=symbol&populate[stock][fields][1]=name&populate[stock][fields][2]=price&populate[stock][fields][3]=previousPrice&populate[stock][fields][4]=updatedAt&pagination[limit]=500`,
  );

  return (response.data ?? [])
    .map((item) => {
      const stock = item.stock;
      if (!stock || !stock.symbol) return null;

      return {
        id: item.documentId ?? String(item.id),
        characterId,
        stockId: stock.documentId ?? String(stock.id),
        quantity: Number(item.quantity ?? 0),
        stock: {
          id: stock.documentId ?? String(stock.id),
          symbol: stock.symbol ?? "",
          name: stock.name ?? "",
          price: Number(stock.price ?? 0),
          previousPrice: Number(stock.previousPrice ?? 0),
          updatedAt: stock.updatedAt ?? new Date(0).toISOString(),
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

async function getPortfolioFromDb(characterId: string) {
  return many(
    `SELECT
      p."id",
      p."characterId",
      p."stockId",
      p."quantity",
      json_build_object(
        'id', s."id",
        'symbol', s."symbol",
        'name', s."name",
        'price', s."price",
        'previousPrice', s."previousPrice",
        'updatedAt', s."updatedAt"
      ) AS "stock"
    FROM "PortfolioItem" p
    JOIN "Stock" s ON s."id" = p."stockId"
    WHERE p."characterId" = $1`,
    [characterId],
  );
}

type PortfolioRow = Awaited<ReturnType<typeof getPortfolioFromDb>>[number];

async function backfillStrapiPortfolioFromLegacy(input: {
  authUserId?: string;
  username?: string;
  portfolio: PortfolioRow[];
}) {
  const headers = getStrapiServiceHeaders();
  if (!headers) return;
  if (!input.portfolio.length) return;

  const profileUrl = new URL(`${STRAPI_BASE_URL}/api/player-profiles`);
  const authUserIdNumber = Number(input.authUserId);
  if (Number.isFinite(authUserIdNumber)) {
    profileUrl.searchParams.set("filters[authUserId][$eq]", String(authUserIdNumber));
  } else if (input.username) {
    profileUrl.searchParams.set("filters[displayName][$eq]", input.username);
  } else {
    return;
  }
  profileUrl.searchParams.set("pagination[limit]", "1");

  const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
  if (!profileRes.ok) return;
  const profileJson = (await profileRes.json()) as { data?: Array<{ id: number; documentId?: string }> };
  const profile = profileJson.data?.[0];
  if (!profile) return;
  const profileIdentifier = profile.documentId ?? String(profile.id);

  for (const row of input.portfolio) {
    const symbol = row.stock?.symbol;
    if (!symbol || row.quantity <= 0) continue;

    const stockLookupUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
    stockLookupUrl.searchParams.set("filters[symbol][$eq]", symbol);
    stockLookupUrl.searchParams.set("pagination[limit]", "1");

    const stockRes = await fetch(stockLookupUrl, { headers, cache: "no-store" });
    if (!stockRes.ok) continue;
    const stockJson = (await stockRes.json()) as { data?: Array<{ id: number; documentId?: string }> };
    const stock = stockJson.data?.[0];
    if (!stock) continue;
    const stockIdentifier = stock.documentId ?? String(stock.id);

    const itemLookupUrl = new URL(`${STRAPI_BASE_URL}/api/portfolio-items`);
    if (Number.isFinite(authUserIdNumber)) {
      itemLookupUrl.searchParams.set("filters[playerProfile][authUserId][$eq]", String(authUserIdNumber));
    } else if (input.username) {
      itemLookupUrl.searchParams.set("filters[playerProfile][displayName][$eq]", input.username);
    }
    itemLookupUrl.searchParams.set("filters[stock][symbol][$eq]", symbol);
    itemLookupUrl.searchParams.set("pagination[limit]", "1");

    const itemRes = await fetch(itemLookupUrl, { headers, cache: "no-store" });
    if (!itemRes.ok) continue;
    const itemJson = (await itemRes.json()) as { data?: Array<{ id: number; documentId?: string; quantity?: number }> };
    const existing = itemJson.data?.[0];

    if (!existing) {
      await fetch(`${STRAPI_BASE_URL}/api/portfolio-items`, {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({ data: { playerProfile: profileIdentifier, stock: stockIdentifier, quantity: row.quantity } }),
      });
      continue;
    }

    const itemIdentifier = existing.documentId ?? String(existing.id);
    if (Number(existing.quantity ?? 0) !== row.quantity) {
      await fetch(`${STRAPI_BASE_URL}/api/portfolio-items/${itemIdentifier}`, {
        method: "PUT",
        headers,
        cache: "no-store",
        body: JSON.stringify({ data: { quantity: row.quantity } }),
      });
    }
  }
}

export async function getPortfolioForCharacter(characterId: string, authUserId?: string, username?: string) {
  try {
    const portfolio = await getPortfolioFromStrapi(characterId, authUserId, username);
    if (portfolio.length > 0) return portfolio;
    console.warn(`[portfolio-read] Strapi portfolio empty for authUserId=${authUserId ?? "n/a"}, falling back to DB.`);
  } catch (error) {
    console.error(
      `[portfolio-read] Strapi portfolio read failed for authUserId=${authUserId ?? "n/a"}, falling back to DB.`,
      error,
    );
  }

  const legacyPortfolio = await getPortfolioFromDb(characterId);
  try {
    await backfillStrapiPortfolioFromLegacy({ authUserId, username, portfolio: legacyPortfolio });
  } catch (error) {
    console.error(`[portfolio-sync] Legacy->Strapi backfill failed for authUserId=${authUserId ?? "n/a"}.`, error);
  }
  return legacyPortfolio;
}

export async function getTownStateById(townId: string) {
  try {
    const strapiState = await getTownStateFromStrapi(townId);
    if (strapiState) {
      return strapiState;
    }
    console.warn(`[town-state] Strapi had no town for townId=${townId}, falling back to DB.`);
  } catch (error) {
    console.error(`[town-state] Strapi read failed for townId=${townId}, falling back to DB.`, error);
  }

  return getTownStateFromDb(townId);
}
