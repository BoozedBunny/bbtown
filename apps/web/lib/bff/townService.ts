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
  buildingLevel?: number;
  upgradeEndsAt?: string | null;
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

async function getBuildingRecord(buildingId: string, townId?: string): Promise<BuildingLite | null> {
  const headers = getHeaders();
  const url = new URL(`${STRAPI_BASE_URL}/api/building-states`);
  if (townId && townId.trim()) {
    url.searchParams.set("filters[stateId][$eq]", `${townId.trim()}:${buildingId}`);
  } else {
    // Fallback for legacy callers without town context.
    url.searchParams.set("filters[stateId][$endsWith]", `:${buildingId}`);
  }
  url.searchParams.set("pagination[limit]", "1");
  url.searchParams.set("populate[owner][fields][0]", "authUserId");
  url.searchParams.set("populate[owner][fields][1]", "documentId");
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
  if (owner.documentId) return owner.documentId;
  if (typeof owner.id === "number") return String(owner.id);
  if (typeof owner.authUserId === "number") return String(owner.authUserId);
  return null;
}

export async function buyBuildingState(input: { buildingId: string; characterId: string; townId?: string }) {
  const { buildingId, characterId, townId } = input;
  const [building, buyer] = await Promise.all([
    getBuildingRecord(buildingId, townId),
    fetchProfileByIdentifier(characterId),
  ]);

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

export async function getBuildingById(buildingId: string, townId?: string) {
  const building = await getBuildingRecord(buildingId, townId);
  if (!building) return null;
  return {
    id: buildingId,
    ownerId: normalizeOwnerId(building.owner),
    title: building.title ?? "",
    price: Number(building.price ?? 0),
    forSale: Boolean(building.forSale),
    buildingLevel: Number(building.buildingLevel ?? 0),
    upgradeEndsAt: building.upgradeEndsAt ?? null,
  };
}

export async function updateBuildingSettings(
  buildingId: string,
  townId: string | undefined,
  input: { title: string; price: number; forSale: boolean },
) {
  const building = await getBuildingRecord(buildingId, townId);
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

export async function upgradeBuildingState(buildingId: string, characterId: string, townId?: string) {
  const [building, buyer] = await Promise.all([
    getBuildingRecord(buildingId, townId),
    fetchProfileByIdentifier(characterId),
  ]);

  if (!building) throw new Error("Building not found");
  
  const ownerId = normalizeOwnerId(building.owner);
  const buyerId = buyer.documentId ?? String(buyer.id);
  const buyerAuthUserId = buyer.authUserId ? String(buyer.authUserId) : null;
  
  // Need to ensure the characterId passed in matches either the owner.documentId, owner.id, or owner.authUserId. 
  // Normally characterId from session is the profile doc id or id.
  const isOwner = ownerId === characterId || ownerId === buyerId || ownerId === buyerAuthUserId;
  
  if (!isOwner) throw new Error("Not the owner");
  
  if (building.upgradeEndsAt) {
    const endsAt = new Date(building.upgradeEndsAt).getTime();
    if (Date.now() < endsAt) {
      throw new Error("Upgrade is already in progress");
    }
  }

  const specialBuildingIds = ["21", "24", "25", "26"]; // Arena, Casino, Stock Exchange, Bank
  if (specialBuildingIds.includes(buildingId)) {
    throw new Error("Special buildings cannot be upgraded");
  }

  const currentLevel = Number(building.buildingLevel ?? 0);
  if (currentLevel >= 3) {
    throw new Error("Building is already at max level");
  }

  let cost = 0;
  let durationMs = 0;
  
  if (currentLevel === 0) {
    cost = 5000;
    durationMs = 15 * 60 * 1000; // 15 mins
  } else if (currentLevel === 1) {
    cost = 50000;
    durationMs = 24 * 60 * 60 * 1000; // 1 Day
  } else if (currentLevel === 2) {
    cost = 500000;
    durationMs = 7 * 24 * 60 * 60 * 1000; // 7 Days
  }

  const buyerWallet = Number(buyer.wallet ?? 0);
  if (buyerWallet < cost) throw new Error("Not enough funds to upgrade");

  // Deduct cost
  await updateProfileWalletByIdOrDoc(buyer, buyerWallet - cost);

  const upgradeEndsAt = new Date(Date.now() + durationMs).toISOString();

  const headers = getHeaders();
  const buildingIdentifier = building.documentId ?? String(building.id);
  const updateRes = await fetch(`${STRAPI_BASE_URL}/api/building-states/${encodeURIComponent(buildingIdentifier)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { upgradeEndsAt } }),
    cache: "no-store",
  });
  if (!updateRes.ok) {
    const txt = await updateRes.text();
    throw new Error(`Building upgrade update failed: ${updateRes.status} ${txt}`);
  }

  return { walletAfter: buyerWallet - cost };
}
