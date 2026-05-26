
const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";

function getStrapiServiceHeaders(): HeadersInit | null {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

type StrapiPlayerProfile = {
  id: number;
  documentId?: string;
  authUserId?: number;
  displayName?: string;
  wallet?: number;
};

type StrapiStock = {
  id: number;
  documentId?: string;
  symbol?: string;
  name?: string;
  price?: number;
  previousPrice?: number;
};

type StrapiPortfolioItem = {
  id: number;
  documentId?: string;
  quantity?: number;
};

async function syncStrapiPortfolioAndWallet(input: {
  username: string;
  authUserId?: number;
  symbol: string;
  quantityDelta: number;
  walletAfterTrade: number;
}) {
  console.info("[market-sync] start", {
    username: input.username,
    authUserId: input.authUserId ?? null,
    symbol: input.symbol,
    quantityDelta: input.quantityDelta,
    walletAfterTrade: input.walletAfterTrade,
  });

  const headers = getStrapiServiceHeaders();
  if (!headers) {
    console.warn("[market-write] STRAPI_API_TOKEN missing - cannot sync portfolio/wallet to Strapi", {
      username: input.username,
      symbol: input.symbol,
    });
    return;
  }

  const resolveAuthUserId = async (): Promise<number | null> => {
    const parsed = Number(input.authUserId);
    if (Number.isFinite(parsed)) return parsed;

    const userLookupUrl = new URL(`${STRAPI_BASE_URL}/api/users`);
    userLookupUrl.searchParams.set("filters[username][$eq]", input.username);
    userLookupUrl.searchParams.set("pagination[limit]", "1");
    const userRes = await fetch(userLookupUrl, { headers, cache: "no-store" });
    if (!userRes.ok) {
      const text = await userRes.text();
      throw new Error(`Strapi user lookup failed (${userRes.status}): ${text}`);
    }
    const users = (await userRes.json()) as Array<{ id: number; username?: string }>;
    return users?.[0]?.id ?? null;
  };

  const resolvedAuthUserId = await resolveAuthUserId();

  const profileUrl = new URL(`${STRAPI_BASE_URL}/api/player-profiles`);
  if (typeof resolvedAuthUserId === "number" && Number.isFinite(resolvedAuthUserId)) {
    profileUrl.searchParams.set("filters[authUserId][$eq]", String(resolvedAuthUserId));
  } else {
    profileUrl.searchParams.set("filters[displayName][$eq]", input.username);
  }
  profileUrl.searchParams.set("pagination[limit]", "1");

  const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
  console.info("[market-sync] profile lookup", { status: profileRes.status, url: profileUrl.toString(), resolvedAuthUserId });
  if (!profileRes.ok) throw new Error(`Strapi profile lookup failed (${profileRes.status})`);
  const profileJson = (await profileRes.json()) as { data?: StrapiPlayerProfile[] };
  let profile = profileJson.data?.[0];
  if (!profile) {
    console.warn("[market-sync] profile missing, attempting auto-create", { username: input.username, resolvedAuthUserId });
    if (!resolvedAuthUserId) {
      console.warn("[market-sync] cannot auto-create profile without resolved auth user", { username: input.username });
      return;
    }

    const createProfileRes = await fetch(`${STRAPI_BASE_URL}/api/player-profiles`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        data: {
          authUserId: resolvedAuthUserId,
          displayName: input.username,
          wallet: input.walletAfterTrade,
        },
      }),
    });
    if (!createProfileRes.ok) {
      const text = await createProfileRes.text();
      throw new Error(`Strapi profile create failed (${createProfileRes.status}): ${text}`);
    }
    const createdProfileJson = (await createProfileRes.json()) as { data?: StrapiPlayerProfile };
    profile = createdProfileJson.data;
    console.info("[market-sync] profile auto-created", { username: input.username, authUserId: resolvedAuthUserId });
  }
  if (!profile) return;

  const stockUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
  stockUrl.searchParams.set("filters[symbol][$eq]", input.symbol);
  stockUrl.searchParams.set("pagination[limit]", "1");

  const stockRes = await fetch(stockUrl, { headers, cache: "no-store" });
  console.info("[market-sync] stock lookup", { status: stockRes.status, symbol: input.symbol });
  if (!stockRes.ok) throw new Error(`Strapi stock lookup failed (${stockRes.status})`);
  const stockJson = (await stockRes.json()) as { data?: StrapiStock[] };
  const stock = stockJson.data?.[0];
  if (!stock) return;

  const profileIdentifier = profile.documentId ?? String(profile.id);
  const stockIdentifier = stock.documentId ?? String(stock.id);

  const itemUrl = new URL(`${STRAPI_BASE_URL}/api/portfolio-items`);
  itemUrl.searchParams.set("filters[playerProfile][documentId][$eq]", profileIdentifier);
  itemUrl.searchParams.set("filters[stock][symbol][$eq]", input.symbol);
  itemUrl.searchParams.set("pagination[limit]", "1");

  const itemRes = await fetch(itemUrl, { headers, cache: "no-store" });
  console.info("[market-sync] portfolio lookup", { status: itemRes.status, symbol: input.symbol });
  if (!itemRes.ok) throw new Error(`Strapi portfolio lookup failed (${itemRes.status})`);
  const itemJson = (await itemRes.json()) as { data?: StrapiPortfolioItem[] };
  const existing = itemJson.data?.[0];

  if (!existing && input.quantityDelta > 0) {
    const createRes = await fetch(`${STRAPI_BASE_URL}/api/portfolio-items`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        data: {
          playerProfile: profileIdentifier,
          stock: stockIdentifier,
          quantity: input.quantityDelta,
        },
      }),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Strapi portfolio create failed (${createRes.status}): ${text}`);
    }
    console.info("[market-sync] portfolio create", { status: createRes.status, symbol: input.symbol, quantity: input.quantityDelta });
  }

  if (existing) {
    const nextQuantity = Math.max(0, Number(existing.quantity ?? 0) + input.quantityDelta);
    const itemIdentifier = existing.documentId ?? String(existing.id);
    const updateRes = await fetch(`${STRAPI_BASE_URL}/api/portfolio-items/${itemIdentifier}`, {
      method: "PUT",
      headers,
      cache: "no-store",
      body: JSON.stringify({ data: { quantity: nextQuantity } }),
    });
    if (!updateRes.ok) {
      const text = await updateRes.text();
      throw new Error(`Strapi portfolio update failed (${updateRes.status}): ${text}`);
    }
    console.info("[market-sync] portfolio update", { status: updateRes.status, symbol: input.symbol, nextQuantity });
  }

  const profileUpdateRes = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${profileIdentifier}`, {
    method: "PUT",
    headers,
    cache: "no-store",
    body: JSON.stringify({ data: { wallet: input.walletAfterTrade } }),
  });
  if (!profileUpdateRes.ok) {
    const text = await profileUpdateRes.text();
    throw new Error(`Strapi wallet update failed (${profileUpdateRes.status}): ${text}`);
  }
  console.info("[market-sync] wallet update", { status: profileUpdateRes.status, walletAfterTrade: input.walletAfterTrade });
}

async function pruneStrapiStockHistory(stockIdentifier: string, headers: HeadersInit, keep = 1200, batch = 300) {
  const listUrl = new URL(`${STRAPI_BASE_URL}/api/stock-histories`);
  listUrl.searchParams.set("filters[stock][documentId][$eq]", stockIdentifier);
  listUrl.searchParams.set("sort", "timestamp:desc");
  listUrl.searchParams.set("pagination[start]", String(keep));
  listUrl.searchParams.set("pagination[limit]", String(batch));

  const listRes = await fetch(listUrl, { headers, cache: "no-store" });
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Strapi stock-history prune lookup failed (${listRes.status}): ${text}`);
  }

  const listJson = (await listRes.json()) as { data?: Array<{ id: number; documentId?: string }> };
  const stale = listJson.data ?? [];
  for (const entry of stale) {
    const id = entry.documentId ?? String(entry.id);
    const delRes = await fetch(`${STRAPI_BASE_URL}/api/stock-histories/${id}`, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });
    if (!delRes.ok) {
      const text = await delRes.text();
      throw new Error(`Strapi stock-history delete failed (${delRes.status}): ${text}`);
    }
  }

  if (stale.length > 0) {
    console.info(`[market-write] pruned ${stale.length} stock-history rows for stock=${stockIdentifier}`);
  }
}

async function syncStrapiStockTick(input: { symbol: string; previousPrice: number; price: number; timestampIso: string }) {
  const headers = getStrapiServiceHeaders();
  if (!headers) return;

  const stockUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
  stockUrl.searchParams.set("filters[symbol][$eq]", input.symbol);
  stockUrl.searchParams.set("pagination[limit]", "1");

  const stockRes = await fetch(stockUrl, { headers, cache: "no-store" });
  if (!stockRes.ok) {
    const text = await stockRes.text();
    throw new Error(`Strapi stock lookup failed (${stockRes.status}): ${text}`);
  }

  const stockJson = (await stockRes.json()) as { data?: StrapiStock[] };
  const stock = stockJson.data?.[0];
  if (!stock) return;

  const stockIdentifier = stock.documentId ?? String(stock.id);

  const updateRes = await fetch(`${STRAPI_BASE_URL}/api/stocks/${stockIdentifier}`, {
    method: "PUT",
    headers,
    cache: "no-store",
    body: JSON.stringify({ data: { previousPrice: input.previousPrice, price: input.price } }),
  });
  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`Strapi stock update failed (${updateRes.status}): ${text}`);
  }

  const historyRes = await fetch(`${STRAPI_BASE_URL}/api/stock-histories`, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      data: {
        stock: stockIdentifier,
        price: input.price,
        timestamp: input.timestampIso,
      },
    }),
  });
  if (!historyRes.ok) {
    const text = await historyRes.text();
    throw new Error(`Strapi stock-history create failed (${historyRes.status}): ${text}`);
  }

  await pruneStrapiStockHistory(stockIdentifier, headers, 1200, 300);
}

type CompanyProfileSeed = {
  symbol: string;
  name: string;
  basePrice: number;
};

export async function ensureCompanyStocksFromProfiles(profiles: CompanyProfileSeed[]) {
  const headers = getStrapiServiceHeaders();
  if (!headers) throw new Error("Missing STRAPI_API_TOKEN for stock seed");

  for (const stock of profiles) {
    const lookupUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
    lookupUrl.searchParams.set("filters[symbol][$eq]", stock.symbol);
    lookupUrl.searchParams.set("pagination[limit]", "1");
    const lookupRes = await fetch(lookupUrl, { headers, cache: "no-store" });
    if (!lookupRes.ok) {
      const text = await lookupRes.text();
      throw new Error(`Strapi stock lookup failed (${lookupRes.status}): ${text}`);
    }
    const lookupJson = (await lookupRes.json()) as { data?: StrapiStock[] };
    if (lookupJson.data?.[0]) continue;

    const createRes = await fetch(`${STRAPI_BASE_URL}/api/stocks`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        data: {
          symbol: stock.symbol,
          name: stock.name,
          price: stock.basePrice,
          previousPrice: stock.basePrice,
        },
      }),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Strapi stock create failed (${createRes.status}): ${text}`);
    }
  }
}

export async function tickStocksAndReturnSorted() {
  const headers = getStrapiServiceHeaders();
  if (!headers) throw new Error("Missing STRAPI_API_TOKEN for stock tick");

  const stocksUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
  stocksUrl.searchParams.set("pagination[limit]", "500");
  stocksUrl.searchParams.set("sort", "symbol:asc");

  const stocksRes = await fetch(stocksUrl, { headers, cache: "no-store" });
  if (!stocksRes.ok) {
    const text = await stocksRes.text();
    throw new Error(`Strapi stocks read failed (${stocksRes.status}): ${text}`);
  }

  const stocksJson = (await stocksRes.json()) as { data?: StrapiStock[] };
  const stocks = (stocksJson.data ?? []).filter((stock) => stock.symbol);

  for (const stock of stocks) {
    const currentPrice = Number(stock.price ?? 0);
    const changePercent = Math.random() * 0.1 - 0.05;
    const newPrice = Math.max(0.01, currentPrice * (1 + changePercent));
    const tickAtIso = new Date().toISOString();

    await syncStrapiStockTick({
      symbol: String(stock.symbol),
      previousPrice: currentPrice,
      price: newPrice,
      timestampIso: tickAtIso,
    });
  }

  const refreshedRes = await fetch(stocksUrl, { headers, cache: "no-store" });
  if (!refreshedRes.ok) {
    const text = await refreshedRes.text();
    throw new Error(`Strapi stocks refresh failed (${refreshedRes.status}): ${text}`);
  }
  const refreshedJson = (await refreshedRes.json()) as { data?: StrapiStock[] };
  return (refreshedJson.data ?? []).map((stock) => ({
    id: stock.documentId ?? String(stock.id),
    symbol: stock.symbol ?? "",
    name: stock.name ?? "",
    price: Number(stock.price ?? 0),
    previousPrice: Number(stock.previousPrice ?? 0),
    updatedAt: new Date().toISOString(),
  }));
}

async function getStrapiStockPriceBySymbol(symbol: string): Promise<number> {
  const headers = getStrapiServiceHeaders();
  if (!headers) throw new Error("Missing STRAPI_API_TOKEN");

  const stockUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
  stockUrl.searchParams.set("filters[symbol][$eq]", symbol);
  stockUrl.searchParams.set("pagination[limit]", "1");

  const stockRes = await fetch(stockUrl, { headers, cache: "no-store" });
  if (!stockRes.ok) throw new Error(`Stock lookup failed (${stockRes.status})`);
  const stockJson = (await stockRes.json()) as { data?: Array<{ price?: number | string }> };
  const stock = stockJson.data?.[0];
  if (!stock) throw new Error("Stock not found");
  return Number(stock.price ?? 0);
}

async function resolveStrapiNumericUserIdByUsername(username: string): Promise<number> {
  const headers = getStrapiServiceHeaders();
  if (!headers) throw new Error("Missing STRAPI_API_TOKEN");

  const userUrl = new URL(`${STRAPI_BASE_URL}/api/users`);
  userUrl.searchParams.set("filters[username][$eq]", username);
  userUrl.searchParams.set("pagination[limit]", "1");

  const userRes = await fetch(userUrl, { headers, cache: "no-store" });
  if (!userRes.ok) throw new Error(`User lookup failed (${userRes.status})`);
  const users = (await userRes.json()) as Array<{ id: number; username?: string }>;
  const user = users?.[0];
  if (!user) throw new Error(`User not found in Strapi: ${username}`);
  return Number(user.id);
}

async function getStrapiProfileByAuthUserId(authUserId: number): Promise<StrapiPlayerProfile | null> {
  const headers = getStrapiServiceHeaders();
  if (!headers) throw new Error("Missing STRAPI_API_TOKEN");

  const profileUrl = new URL(`${STRAPI_BASE_URL}/api/player-profiles`);
  profileUrl.searchParams.set("filters[authUserId][$eq]", String(authUserId));
  profileUrl.searchParams.set("pagination[limit]", "1");

  const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
  if (!profileRes.ok) throw new Error(`Profile lookup failed (${profileRes.status})`);
  const profileJson = (await profileRes.json()) as { data?: StrapiPlayerProfile[] };
  return profileJson.data?.[0] ?? null;
}

async function getStrapiPortfolioItems(profileIdentifier: string): Promise<Array<{ quantity?: number; stock?: { symbol?: string } }>> {
  const headers = getStrapiServiceHeaders();
  if (!headers) throw new Error("Missing STRAPI_API_TOKEN");

  const itemsUrl = new URL(`${STRAPI_BASE_URL}/api/portfolio-items`);
  itemsUrl.searchParams.set("filters[playerProfile][documentId][$eq]", profileIdentifier);
  itemsUrl.searchParams.set("populate[stock][fields][0]", "symbol");
  itemsUrl.searchParams.set("pagination[limit]", "500");

  const itemsRes = await fetch(itemsUrl, { headers, cache: "no-store" });
  if (!itemsRes.ok) throw new Error(`Portfolio lookup failed (${itemsRes.status})`);
  const itemsJson = (await itemsRes.json()) as { data?: Array<{ quantity?: number; stock?: { symbol?: string } }> };
  return itemsJson.data ?? [];
}

export async function buyStockForCharacter(input: {
  username: string;
  symbol: string;
  quantity: number;
}) {
  const authUserId = await resolveStrapiNumericUserIdByUsername(input.username);
  const profile = await getStrapiProfileByAuthUserId(authUserId);
  if (!profile) throw new Error("Player profile not found");

  const price = await getStrapiStockPriceBySymbol(input.symbol);
  const rawCost = price * input.quantity;
  const cost = Math.max(1, Math.ceil(rawCost));

  const currentWallet = Number(profile.wallet ?? 0);
  if (currentWallet < cost) {
    return { ok: false as const, reason: "INSUFFICIENT_FUNDS" as const, cost };
  }

  const newWallet = Math.max(0, currentWallet - cost);
  await syncStrapiPortfolioAndWallet({
    username: input.username,
    authUserId,
    symbol: input.symbol,
    quantityDelta: input.quantity,
    walletAfterTrade: newWallet,
  });

  return {
    ok: true as const,
    cost,
    newWallet,
  };
}

export async function sellStockForCharacter(input: {
  username: string;
  symbol: string;
  quantity: number;
}) {
  const authUserId = await resolveStrapiNumericUserIdByUsername(input.username);
  const profile = await getStrapiProfileByAuthUserId(authUserId);
  if (!profile) throw new Error("Player profile not found");

  const holdings = await getStrapiPortfolioItems(profile.documentId ?? String(profile.id));
  const symbolUpper = input.symbol.toUpperCase();
  const owned = holdings
    .filter((item) => item.stock?.symbol?.toUpperCase() === symbolUpper)
    .reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

  if (owned < input.quantity) {
    return { ok: false as const, reason: "NOT_ENOUGH_SHARES" as const };
  }

  const price = await getStrapiStockPriceBySymbol(input.symbol);
  const rawGain = price * input.quantity;
  const gain = Math.max(0, Math.floor(rawGain));

  const currentWallet = Number(profile.wallet ?? 0);
  const newWallet = Math.max(0, Math.floor(currentWallet + gain));

  await syncStrapiPortfolioAndWallet({
    username: input.username,
    authUserId,
    symbol: input.symbol,
    quantityDelta: -input.quantity,
    walletAfterTrade: newWallet,
  });

  return {
    ok: true as const,
    gain,
    newWallet,
  };
}

async function getStrapiProfileByUsername(username: string): Promise<any | null> {
  const authUserId = await resolveStrapiNumericUserIdByUsername(username);
  const profile = await getStrapiProfileByAuthUserId(authUserId);
  return profile;
}

async function patchStrapiProfile(profileIdentifier: string, data: Record<string, unknown>) {
  const headers = getStrapiServiceHeaders();
  if (!headers) throw new Error("Missing STRAPI_API_TOKEN");

  const res = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${encodeURIComponent(profileIdentifier)}`, {
    method: "PUT",
    headers,
    cache: "no-store",
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Profile update failed (${res.status}): ${text}`);
  }
}

export async function applyArenaResult(input: {
  winner?: string;
  loser?: string;
  reward: number;
  isSolo: boolean;
  roundsReached: number;
}) {
  if (!input.isSolo) {
    if (input.winner) {
      const winner = await getStrapiProfileByUsername(input.winner);
      if (winner) {
        const id = winner.documentId ?? String(winner.id);
        await patchStrapiProfile(id, {
          experience: Number(winner.experience ?? 0) + 50,
          wallet: Number(winner.wallet ?? 0) + input.reward,
        });
      }
    }

    if (input.loser) {
      const loser = await getStrapiProfileByUsername(input.loser);
      if (loser) {
        const id = loser.documentId ?? String(loser.id);
        await patchStrapiProfile(id, {
          experience: Number(loser.experience ?? 0) + 10,
        });
      }
    }
    return;
  }

  const playerUsername = input.winner ?? input.loser;
  if (!playerUsername) return;

  const profile = await getStrapiProfileByUsername(playerUsername);
  if (!profile) return;

  const now = new Date();
  const currentArenaMaxRounds = Number(profile.arenaMaxRounds ?? 0);
  const lastSolo = profile.lastSoloArenaAt ? new Date(profile.lastSoloArenaAt) : null;

  let shouldGrantSoloXP = false;
  if (!lastSolo) {
    shouldGrantSoloXP = true;
  } else if (
    lastSolo.getUTCFullYear() !== now.getUTCFullYear() ||
    lastSolo.getUTCMonth() !== now.getUTCMonth() ||
    lastSolo.getUTCDate() !== now.getUTCDate()
  ) {
    shouldGrantSoloXP = true;
  }

  const patch: Record<string, unknown> = {};
  if (input.roundsReached > currentArenaMaxRounds) {
    patch.arenaMaxRounds = input.roundsReached;
  }
  if (shouldGrantSoloXP) {
    patch.experience = Number(profile.experience ?? 0) + 10;
    patch.lastSoloArenaAt = now.toISOString();
  }

  if (Object.keys(patch).length > 0) {
    const id = profile.documentId ?? String(profile.id);
    await patchStrapiProfile(id, patch);
  }
}
