import { strapiFetchList } from "@/lib/cms/strapi";

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
  id?: number;
  documentId?: string;
  authUserId?: number;
  displayName?: string;
  avatar?: string;
};

type StrapiBuildingState = {
  stateId?: string;
  title?: string;
  forSale?: boolean;
  price?: number;
  employees?: number;
  owner?: StrapiRelation<StrapiOwnerProfile> | StrapiOwnerProfile | null;
  town?: StrapiRelation<StrapiTown> | StrapiTown | null;
};

function unwrapRelation<T>(value: StrapiRelation<T> | T | null | undefined): T | null {
  if (!value) return null;
  if (typeof value === "object" && "data" in value) {
    return (value as StrapiRelation<T>).data ?? null;
  }
  return value as T;
}

function normalizeTownId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function mapStrapiBuildingState(row: StrapiBuildingState, townIdFromContext: string) {
  const stateId = row.stateId ?? "";
  const buildingId = stateId.includes(":") ? stateId.split(":")[1] : stateId;
  const owner = unwrapRelation(row.owner);
  const ownerId = owner?.documentId ?? (typeof owner?.id === "number" ? String(owner.id) : null);
  const isForSale = typeof row.forSale === "boolean" ? row.forSale : !ownerId;

  return {
    id: buildingId || stateId,
    townId: townIdFromContext,
    title: row.title ?? "",
    forSale: isForSale,
    price: Number(row.price ?? 0),
    employees: Number(row.employees ?? 0),
    ownerId,
    owner: owner
      ? {
          name: owner.displayName ?? null,
          avatar: owner.avatar ?? null,
        }
      : null,
  };
}

async function getTownStateFromStrapi(townId: string) {
  const [townResponse, buildingStatesResponse] = await Promise.all([
    strapiFetchList<StrapiTown>(
      `/api/towns?filters[townId][$eq]=${encodeURIComponent(townId)}&pagination[limit]=1`,
      { cache: "no-store" },
    ),
    strapiFetchList<StrapiBuildingState>(
      `/api/building-states?filters[town][townId][$eq]=${encodeURIComponent(townId)}&populate[owner][fields][0]=displayName&populate[owner][fields][1]=avatar&populate[owner][fields][2]=documentId&populate[owner][fields][3]=authUserId&pagination[limit]=500`,
      { cache: "no-store" },
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

async function resolveNumericStrapiUserId(authUserId?: string, username?: string): Promise<number | null> {
  const parsed = Number(authUserId);
  if (Number.isFinite(parsed)) return parsed;
  if (!username) return null;

  const headers = getStrapiServiceHeaders();
  if (!headers) return null;

  const userLookupUrl = new URL(`${STRAPI_BASE_URL}/api/users`);
  userLookupUrl.searchParams.set("filters[username][$eq]", username);
  userLookupUrl.searchParams.set("pagination[limit]", "1");

  const userRes = await fetch(userLookupUrl, { headers, cache: "no-store" });
  if (!userRes.ok) return null;
  const userJson = (await userRes.json()) as { data?: Array<{ id?: number }> };
  const userId = Number(userJson.data?.[0]?.id);
  return Number.isFinite(userId) ? userId : null;
}

async function getPortfolioFromStrapi(characterId: string, authUserId?: string, username?: string) {
  if (!authUserId && !username) return [];

  const resolvedAuthUserId = await resolveNumericStrapiUserId(authUserId, username);

  const profileUrl = new URL(`${STRAPI_BASE_URL}/api/player-profiles`);
  if (resolvedAuthUserId !== null) {
    profileUrl.searchParams.set("filters[authUserId][$eq]", String(resolvedAuthUserId));
  } else if (username) {
    profileUrl.searchParams.set("filters[displayName][$eq]", username);
  } else {
    return [];
  }
  profileUrl.searchParams.set("pagination[limit]", "1");

  const headers = getStrapiServiceHeaders();
  if (!headers) return [];

  const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
  if (!profileRes.ok) return [];
  const profileJson = (await profileRes.json()) as { data?: Array<{ id: number; documentId?: string }> };
  const profile = profileJson.data?.[0];
  if (!profile) return [];
  const profileIdentifier = profile.documentId ?? String(profile.id);

  const response = await strapiFetchList<StrapiPortfolioItem>(
    `/api/portfolio-items?filters[playerProfile][documentId][$eq]=${encodeURIComponent(profileIdentifier)}&populate[stock][fields][0]=symbol&populate[stock][fields][1]=name&populate[stock][fields][2]=price&populate[stock][fields][3]=previousPrice&populate[stock][fields][4]=updatedAt&pagination[limit]=500`,
    { cache: "no-store" }
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

export async function getPortfolioForCharacter(characterId: string, authUserId?: string, username?: string) {
  const portfolio = await getPortfolioFromStrapi(characterId, authUserId, username);
  console.info(`[portfolio-read] source=strapi authUserId=${authUserId ?? "n/a"} username=${username ?? "n/a"} count=${portfolio.length}`);
  return portfolio;
}

export async function getTownStateById(townId: string) {
  const strapiState = await getTownStateFromStrapi(townId);
  if (!strapiState) {
    throw new Error(`[town-state] Missing town in Strapi for townId=${townId}`);
  }
  return strapiState;
}
