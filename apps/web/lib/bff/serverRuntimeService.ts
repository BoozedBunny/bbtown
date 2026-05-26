import { randomUUID } from "crypto";
import { many, oneOrNull, withTransaction } from "@/lib/db";
import { getRuntimeFlags } from "@/lib/config/runtimeFlags";

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
  const flags = getRuntimeFlags();
  if (flags.strapiSotMode === "on") {
    console.info("[market-write] skip legacy->strapi sync (STRAPI_SOT_MODE=on)", {
      write_target: "strapi",
      source: "user_action",
      username: input.username,
      symbol: input.symbol,
    });
    return;
  }

  const headers = getStrapiServiceHeaders();
  if (!headers) return;

  const profileUrl = new URL(`${STRAPI_BASE_URL}/api/player-profiles`);
  if (typeof input.authUserId === "number" && Number.isFinite(input.authUserId)) {
    profileUrl.searchParams.set("filters[authUserId][$eq]", String(input.authUserId));
  } else {
    profileUrl.searchParams.set("filters[displayName][$eq]", input.username);
  }
  profileUrl.searchParams.set("pagination[limit]", "1");

  const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
  if (!profileRes.ok) throw new Error(`Strapi profile lookup failed (${profileRes.status})`);
  const profileJson = (await profileRes.json()) as { data?: StrapiPlayerProfile[] };
  const profile = profileJson.data?.[0];
  if (!profile) return;

  const stockUrl = new URL(`${STRAPI_BASE_URL}/api/stocks`);
  stockUrl.searchParams.set("filters[symbol][$eq]", input.symbol);
  stockUrl.searchParams.set("pagination[limit]", "1");

  const stockRes = await fetch(stockUrl, { headers, cache: "no-store" });
  if (!stockRes.ok) throw new Error(`Strapi stock lookup failed (${stockRes.status})`);
  const stockJson = (await stockRes.json()) as { data?: StrapiStock[] };
  const stock = stockJson.data?.[0];
  if (!stock) return;

  const profileIdentifier = profile.documentId ?? String(profile.id);
  const stockIdentifier = stock.documentId ?? String(stock.id);

  const itemUrl = new URL(`${STRAPI_BASE_URL}/api/portfolio-items`);
  if (typeof input.authUserId === "number" && Number.isFinite(input.authUserId)) {
    itemUrl.searchParams.set("filters[playerProfile][authUserId][$eq]", String(input.authUserId));
  } else {
    itemUrl.searchParams.set("filters[playerProfile][displayName][$eq]", input.username);
  }
  itemUrl.searchParams.set("filters[stock][symbol][$eq]", input.symbol);
  itemUrl.searchParams.set("pagination[limit]", "1");

  const itemRes = await fetch(itemUrl, { headers, cache: "no-store" });
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
  }

  if (flags.strapiAdminOverrideWins) {
    console.info("[market-write] skip strapi wallet overwrite (STRAPI_ADMIN_OVERRIDE_WINS=true)", {
      write_target: "strapi",
      source: "user_action",
      username: input.username,
      symbol: input.symbol,
    });
    return;
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

type LegacyCharacterProfileSync = {
  wallet?: number;
  name?: string;
  avatar?: string;
  description?: string | null;
  appearanceColor?: string;
  arenaMaxRounds?: number;
  experience?: number;
};

export async function ensureCompanyStocksFromProfiles(profiles: CompanyProfileSeed[]) {
  for (const stock of profiles) {
    await oneOrNull(
      'INSERT INTO "Stock" ("id", "symbol", "name", "price", "previousPrice", "updatedAt") VALUES ($1, $2, $3, $4, $4, NOW()) ON CONFLICT ("symbol") DO NOTHING RETURNING "id"',
      [randomUUID(), stock.symbol, stock.name, stock.basePrice],
    );
  }
}

export async function tickStocksAndReturnSorted() {
  const stocks = await many<any>('SELECT * FROM "Stock"');
  for (const stock of stocks) {
    const changePercent = Math.random() * 0.1 - 0.05;
    const newPrice = Math.max(0.01, stock.price * (1 + changePercent));
    const tickAtIso = new Date().toISOString();

    await withTransaction(async (tx) => {
      await tx.query('UPDATE "Stock" SET "previousPrice" = $2, "price" = $3, "updatedAt" = NOW() WHERE "id" = $1', [stock.id, stock.price, newPrice]);
      await tx.query(
        'INSERT INTO "StockHistory" ("id", "stockId", "price", "timestamp") VALUES ($1, $2, $3, NOW())',
        [randomUUID(), stock.id, newPrice],
      );
    });

    try {
      await syncStrapiStockTick({
        symbol: stock.symbol,
        previousPrice: stock.price,
        price: newPrice,
        timestampIso: tickAtIso,
      });
    } catch (error) {
      console.error(`[market-write] Strapi tick sync failed for symbol=${stock.symbol}; legacy tick kept.`, error);
    }
  }

  return many('SELECT * FROM "Stock" ORDER BY "symbol" ASC');
}

export async function upsertLegacyCharacterForUsername(
  username: string,
  profile?: LegacyCharacterProfileSync,
) {
  const legacyUser = await oneOrNull<{ id: string }>(
    'INSERT INTO "User" ("id", "username", "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT ("username") DO UPDATE SET "username" = EXCLUDED."username", "updatedAt" = NOW() RETURNING "id"',
    [randomUUID(), username],
  );
  if (!legacyUser) throw new Error("Failed to upsert user");

  const existingCharacter = await oneOrNull<any>('SELECT * FROM "Character" WHERE "userId" = $1 LIMIT 1', [legacyUser.id]);

  if (existingCharacter) {
    await oneOrNull(
      'UPDATE "Character" SET "name" = $2, "avatar" = $3, "description" = $4, "appearanceColor" = $5, "wallet" = $6, "arenaMaxRounds" = $7, "experience" = $8 WHERE "id" = $1 RETURNING "id"',
      [
        existingCharacter.id,
        profile?.name ?? existingCharacter.name,
        profile?.avatar ?? existingCharacter.avatar,
        profile?.description ?? existingCharacter.description,
        profile?.appearanceColor ?? existingCharacter.appearanceColor,
        profile?.wallet ?? existingCharacter.wallet,
        profile?.arenaMaxRounds ?? existingCharacter.arenaMaxRounds,
        profile?.experience ?? existingCharacter.experience,
      ],
    );
    return existingCharacter.id;
  }

  const created = await oneOrNull<{ id: string }>(
    'INSERT INTO "Character" ("id", "userId", "name", "appearanceColor", "avatar", "description", "wallet", "arenaMaxRounds", "experience") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING "id"',
    [
      randomUUID(),
      legacyUser.id,
      profile?.name ?? username,
      profile?.appearanceColor ?? "#BD00FF",
      profile?.avatar ?? "bunny",
      profile?.description ?? null,
      profile?.wallet ?? 1000,
      profile?.arenaMaxRounds ?? 0,
      profile?.experience ?? 0,
    ],
  );

  if (!created) throw new Error("Failed to create character");
  return created.id;
}

export async function getCharacterById(characterId: string) {
  return oneOrNull('SELECT * FROM "Character" WHERE "id" = $1 LIMIT 1', [characterId]);
}

export async function getCharacterByUsername(username: string) {
  return oneOrNull(
    `SELECT c.*
     FROM "Character" c
     JOIN "User" u ON u."id" = c."userId"
     WHERE u."username" = $1
     LIMIT 1`,
    [username],
  );
}

export async function getAvatarForUsername(username: string) {
  const user = await oneOrNull<{ avatar: string | null }>(
    `SELECT c."avatar"
     FROM "User" u
     LEFT JOIN "Character" c ON c."userId" = u."id"
     WHERE u."username" = $1
     LIMIT 1`,
    [username],
  );
  return user?.avatar ?? "bunny";
}

export async function buyStockForCharacter(input: {
  characterId: string;
  symbol: string;
  quantity: number;
}) {
  const character = await oneOrNull<{ wallet: number }>('SELECT "wallet" FROM "Character" WHERE "id" = $1 LIMIT 1', [input.characterId]);
  if (!character) throw new Error("Character not found");

  const stock = await oneOrNull<{ id: string; price: number }>('SELECT "id", "price" FROM "Stock" WHERE "symbol" = $1 LIMIT 1', [input.symbol]);
  if (!stock) throw new Error("Stock not found");

  const rawCost = stock.price * input.quantity;
  const cost = Math.max(1, Math.ceil(rawCost));
  if (character.wallet < cost) {
    return { ok: false as const, reason: "INSUFFICIENT_FUNDS" as const, cost };
  }

  await withTransaction(async (tx) => {
    await tx.query('UPDATE "Character" SET "wallet" = "wallet" - $2 WHERE "id" = $1', [input.characterId, cost]);
    await tx.query(
      `INSERT INTO "PortfolioItem" ("id", "characterId", "stockId", "quantity")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("characterId", "stockId") DO UPDATE
       SET "quantity" = "PortfolioItem"."quantity" + EXCLUDED."quantity"`,
      [randomUUID(), input.characterId, stock.id, input.quantity],
    );
  });

  const newWallet = Math.max(0, character.wallet - cost);
  const owner = await oneOrNull<{ username: string; authUserId: number | null }>(
    `SELECT u."username", u."id" as "authUserId"
     FROM "Character" c
     JOIN "User" u ON u."id" = c."userId"
     WHERE c."id" = $1
     LIMIT 1`,
    [input.characterId],
  );

  if (owner?.username) {
    try {
      await syncStrapiPortfolioAndWallet({
        username: owner.username,
        authUserId: owner.authUserId ?? undefined,
        symbol: input.symbol,
        quantityDelta: input.quantity,
        walletAfterTrade: newWallet,
      });
    } catch (error) {
      console.error("[market-write] Strapi sync failed after buy; DB write kept as source of truth.", error);
    }
  }

  return {
    ok: true as const,
    cost,
    newWallet,
  };
}

export async function sellStockForCharacter(input: {
  characterId: string;
  symbol: string;
  quantity: number;
}) {
  const character = await oneOrNull<{ wallet: number }>('SELECT "wallet" FROM "Character" WHERE "id" = $1 LIMIT 1', [input.characterId]);
  if (!character) throw new Error("Character not found");

  const stock = await oneOrNull<{ id: string; price: number }>('SELECT "id", "price" FROM "Stock" WHERE "symbol" = $1 LIMIT 1', [input.symbol]);
  if (!stock) throw new Error("Stock not found");

  const portfolioItem = await oneOrNull<{ id: string; quantity: number }>(
    'SELECT "id", "quantity" FROM "PortfolioItem" WHERE "characterId" = $1 AND "stockId" = $2 LIMIT 1',
    [input.characterId, stock.id],
  );

  if (!portfolioItem || portfolioItem.quantity < input.quantity) {
    return { ok: false as const, reason: "NOT_ENOUGH_SHARES" as const };
  }

  const rawGain = stock.price * input.quantity;
  const gain = Math.max(0, Math.floor(rawGain));

  await withTransaction(async (tx) => {
    await tx.query('UPDATE "Character" SET "wallet" = "wallet" + $2 WHERE "id" = $1', [input.characterId, gain]);
    await tx.query('UPDATE "PortfolioItem" SET "quantity" = "quantity" - $2 WHERE "id" = $1', [portfolioItem.id, input.quantity]);
  });

  const newWallet = Math.max(0, Math.floor(character.wallet + gain));
  const owner = await oneOrNull<{ username: string; authUserId: number | null }>(
    `SELECT u."username", u."id" as "authUserId"
     FROM "Character" c
     JOIN "User" u ON u."id" = c."userId"
     WHERE c."id" = $1
     LIMIT 1`,
    [input.characterId],
  );

  if (owner?.username) {
    try {
      await syncStrapiPortfolioAndWallet({
        username: owner.username,
        authUserId: owner.authUserId ?? undefined,
        symbol: input.symbol,
        quantityDelta: -input.quantity,
        walletAfterTrade: newWallet,
      });
    } catch (error) {
      console.error("[market-write] Strapi sync failed after sell; DB write kept as source of truth.", error);
    }
  }

  return {
    ok: true as const,
    gain,
    newWallet,
  };
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
      await oneOrNull(
        `UPDATE "Character"
         SET "experience" = "experience" + 50, "wallet" = "wallet" + $2
         WHERE "userId" IN (SELECT "id" FROM "User" WHERE "username" = $1)
         RETURNING "id"`,
        [input.winner, input.reward],
      );
    }
    if (input.loser) {
      await oneOrNull(
        `UPDATE "Character"
         SET "experience" = "experience" + 10
         WHERE "userId" IN (SELECT "id" FROM "User" WHERE "username" = $1)
         RETURNING "id"`,
        [input.loser],
      );
    }
    return;
  }

  const playerUsername = input.winner ?? input.loser;
  if (!playerUsername) return;

  const character = await oneOrNull<any>(
    `SELECT c.*
     FROM "Character" c
     JOIN "User" u ON u."id" = c."userId"
     WHERE u."username" = $1
     LIMIT 1`,
    [playerUsername],
  );
  if (!character) return;

  if (input.roundsReached > character.arenaMaxRounds) {
    await oneOrNull('UPDATE "Character" SET "arenaMaxRounds" = $2 WHERE "id" = $1 RETURNING "id"', [character.id, input.roundsReached]);
  }

  const now = new Date();
  const lastSolo = character.lastSoloArenaAt ? new Date(character.lastSoloArenaAt) : null;
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

  if (shouldGrantSoloXP) {
    await oneOrNull(
      'UPDATE "Character" SET "experience" = "experience" + 10, "lastSoloArenaAt" = $2 WHERE "id" = $1 RETURNING "id"',
      [character.id, now],
    );
  }
}
