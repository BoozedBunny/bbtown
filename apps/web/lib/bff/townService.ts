const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";

type ProfileLite = {
  id: number;
  documentId?: string;
  authUserId?: number;
  wallet?: number;
};

type BuildingLite = {
  id: number;
  documentId?: string;
  stateId?: string;
  title?: string;
  price?: number;
  forSale?: boolean;
  town?: { id?: number; documentId?: string; townId?: string | number } | null;
  owner?: { id?: number; documentId?: string; authUserId?: number } | null;
};

function getHeaders(): HeadersInit {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error("Missing STRAPI_API_TOKEN");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function fetchProfileByIdentifier(profileIdentifier: string): Promise<ProfileLite> {
  const headers = getHeaders();

  const numericId = Number(profileIdentifier);
  if (Number.isFinite(numericId) && numericId > 0) {
    const byId = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${numericId}`, { headers, cache: "no-store" });
    if (byId.ok) {
      const payload = (await byId.json()) as { data?: ProfileLite };
      if (payload.data) return payload.data;
    }
  }

  const byDoc = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${encodeURIComponent(profileIdentifier)}`, {
    headers,
    cache: "no-store",
  });
  if (!byDoc.ok) {
    const txt = await byDoc.text();
    throw new Error(`Profile fetch failed: ${byDoc.status} ${txt}`);
  }
  const payload = (await byDoc.json()) as { data?: ProfileLite };
  if (!payload.data) throw new Error("Profile not found");
  return payload.data;
}

async function updateProfileWalletByIdOrDoc(profile: ProfileLite, wallet: number) {
  const headers = getHeaders();
  const identifier = profile.documentId ?? String(profile.id);
  const res = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${encodeURIComponent(identifier)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { wallet } }),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Profile wallet update failed: ${res.status} ${txt}`);
  }
}

async function getBuildingRecord(buildingId: string): Promise<BuildingLite | null> {
  const headers = getHeaders();
  const url = new URL(`${STRAPI_BASE_URL}/api/building-states`);
  url.searchParams.set("filters[stateId][$contains]", `:${buildingId}`);
  url.searchParams.set("pagination[limit]", "1");
  url.searchParams.set("populate[owner][fields][0]", "authUserId");
  url.searchParams.set("populate[town][fields][0]", "townId");

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Building fetch failed: ${res.status}`);
  const payload = (await res.json()) as { data?: BuildingLite[] };
  return payload.data?.[0] ?? null;
}

async function updateTownBankBalanceByTownId(townId: string | number, delta: number) {
  const headers = getHeaders();
  const url = new URL(`${STRAPI_BASE_URL}/api/towns`);
  url.searchParams.set("filters[townId][$eq]", String(townId));
  url.searchParams.set("pagination[limit]", "1");
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Town fetch failed: ${res.status}`);
  const payload = (await res.json()) as { data?: Array<{ id: number; documentId?: string; bankBalance?: number }> };
  const town = payload.data?.[0];
  if (!town) throw new Error("Town not found");
  const nextBank = Number(town.bankBalance ?? 0) + delta;
  const identifier = town.documentId ?? String(town.id);
  const update = await fetch(`${STRAPI_BASE_URL}/api/towns/${encodeURIComponent(identifier)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { bankBalance: nextBank } }),
    cache: "no-store",
  });
  if (!update.ok) {
    const txt = await update.text();
    throw new Error(`Town update failed: ${update.status} ${txt}`);
  }
}

function normalizeOwnerId(owner: BuildingLite["owner"]): string | null {
  if (!owner) return null;
  if (typeof owner.id === "number") return String(owner.id);
  if (owner.documentId) return owner.documentId;
  return null;
}

export async function buyBuildingLegacy(input: { buildingId: string; legacyCharacterId: string }) {
  const { buildingId, legacyCharacterId } = input;
  const [building, buyer] = await Promise.all([getBuildingRecord(buildingId), fetchProfileByIdentifier(legacyCharacterId)]);

  if (!building) throw new Error("Building not found");
  if (!building.forSale) throw new Error("Building is not for sale");

  const price = Number(building.price ?? 0);
  const buyerWallet = Number(buyer.wallet ?? 0);
  if (buyerWallet < price) throw new Error("Not enough funds");

  const owner = building.owner;
  if (owner && (owner.id || owner.documentId)) {
    const ownerIdentifier = owner.documentId ?? String(owner.id);
    const sellerProfile = await fetchProfileByIdentifier(ownerIdentifier);
    await updateProfileWalletByIdOrDoc(sellerProfile, Number(sellerProfile.wallet ?? 0) + price);
  } else {
    const townId = building.town?.townId ?? "1";
    await updateTownBankBalanceByTownId(townId, price);
  }

  await updateProfileWalletByIdOrDoc(buyer, buyerWallet - price);

  const headers = getHeaders();
  const buildingIdentifier = building.documentId ?? String(building.id);
  const ownerIdForRelation = buyer.id;
  const updateRes = await fetch(`${STRAPI_BASE_URL}/api/building-states/${encodeURIComponent(buildingIdentifier)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { owner: ownerIdForRelation, forSale: false } }),
    cache: "no-store",
  });
  if (!updateRes.ok) {
    const txt = await updateRes.text();
    throw new Error(`Building purchase update failed: ${updateRes.status} ${txt}`);
  }

  return { walletAfter: buyerWallet - price };
}

export async function getBuildingById(buildingId: string) {
  const building = await getBuildingRecord(buildingId);
  if (!building) return null;
  return {
    id: buildingId,
    ownerId: normalizeOwnerId(building.owner),
    title: building.title ?? "",
    price: Number(building.price ?? 0),
    forSale: Boolean(building.forSale),
  };
}

export async function updateBuildingSettingsLegacy(
  buildingId: string,
  input: { title: string; price: number; forSale: boolean },
) {
  const building = await getBuildingRecord(buildingId);
  if (!building) return null;

  const headers = getHeaders();
  const identifier = building.documentId ?? String(building.id);
  const res = await fetch(`${STRAPI_BASE_URL}/api/building-states/${encodeURIComponent(identifier)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { title: input.title, price: input.price, forSale: input.forSale } }),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Building settings update failed: ${res.status} ${txt}`);
  }
  const payload = (await res.json()) as { data?: BuildingLite };
  return payload.data ?? null;
}
