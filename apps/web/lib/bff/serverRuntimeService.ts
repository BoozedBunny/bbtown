import { randomUUID } from "crypto";
import { many, oneOrNull, withTransaction } from "@/lib/db";

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

    await withTransaction(async (tx) => {
      await tx.query('UPDATE "Stock" SET "previousPrice" = $2, "price" = $3, "updatedAt" = NOW() WHERE "id" = $1', [stock.id, stock.price, newPrice]);
    });
  }

  return many('SELECT * FROM "Stock" ORDER BY "symbol" ASC');
}

export async function upsertLegacyCharacterForUsername(
  username: string,
  profile?: LegacyCharacterProfileSync,
) {
  const legacyUser = await oneOrNull<{ id: string }>(
    'INSERT INTO "User" ("username") VALUES ($1) ON CONFLICT ("username") DO UPDATE SET "username" = EXCLUDED."username" RETURNING "id"',
    [username],
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
    'INSERT INTO "Character" ("userId", "name", "appearanceColor", "avatar", "description", "wallet", "arenaMaxRounds", "experience") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING "id"',
    [
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

  const cost = stock.price * input.quantity;
  if (character.wallet < cost) {
    return { ok: false as const, reason: "INSUFFICIENT_FUNDS" as const, cost };
  }

  await withTransaction(async (tx) => {
    await tx.query('UPDATE "Character" SET "wallet" = "wallet" - $2 WHERE "id" = $1', [input.characterId, cost]);
    await tx.query(
      `INSERT INTO "PortfolioItem" ("characterId", "stockId", "quantity")
       VALUES ($1, $2, $3)
       ON CONFLICT ("characterId", "stockId") DO UPDATE
       SET "quantity" = "PortfolioItem"."quantity" + EXCLUDED."quantity"`,
      [input.characterId, stock.id, input.quantity],
    );
  });

  return {
    ok: true as const,
    cost,
    newWallet: Math.max(0, Math.floor(character.wallet - cost)),
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

  const gain = stock.price * input.quantity;

  await withTransaction(async (tx) => {
    await tx.query('UPDATE "Character" SET "wallet" = "wallet" + $2 WHERE "id" = $1', [input.characterId, gain]);
    await tx.query('UPDATE "PortfolioItem" SET "quantity" = "quantity" - $2 WHERE "id" = $1', [portfolioItem.id, input.quantity]);
  });

  return {
    ok: true as const,
    gain,
    newWallet: Math.max(0, Math.floor(character.wallet + gain)),
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
