import { strapiFetchList } from "@/lib/cms/strapi";
import { many, oneOrNull } from "@/lib/db";

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

  return getPortfolioFromDb(characterId);
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
