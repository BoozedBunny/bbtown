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

export async function getPortfolioForCharacter(characterId: string) {
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
