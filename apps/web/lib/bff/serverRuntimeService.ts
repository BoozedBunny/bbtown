import { prisma } from "@/lib/prisma";

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
    await prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: {},
      create: {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.basePrice,
        previousPrice: stock.basePrice,
      },
    });
  }
}

export async function tickStocksAndReturnSorted() {
  const stocks = await prisma.stock.findMany();
  for (const stock of stocks) {
    const changePercent = Math.random() * 0.1 - 0.05;
    const newPrice = Math.max(0.01, stock.price * (1 + changePercent));

    await prisma.$transaction([
      prisma.stock.update({
        where: { id: stock.id },
        data: {
          previousPrice: stock.price,
          price: newPrice,
        },
      }),
      prisma.stockHistory.create({
        data: {
          stockId: stock.id,
          price: newPrice,
        },
      }),
    ]);
  }

  return prisma.stock.findMany({ orderBy: { symbol: "asc" } });
}

export async function upsertLegacyCharacterForUsername(
  username: string,
  profile?: LegacyCharacterProfileSync,
) {
  const legacyUser = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username },
  });

  const existingCharacter = await prisma.character.findUnique({ where: { userId: legacyUser.id } });

  if (existingCharacter) {
    await prisma.character.update({
      where: { id: existingCharacter.id },
      data: {
        name: profile?.name ?? existingCharacter.name,
        avatar: profile?.avatar ?? existingCharacter.avatar,
        description: profile?.description ?? existingCharacter.description,
        appearanceColor: profile?.appearanceColor ?? existingCharacter.appearanceColor,
        wallet: profile?.wallet ?? existingCharacter.wallet,
        arenaMaxRounds: profile?.arenaMaxRounds ?? existingCharacter.arenaMaxRounds,
        experience: profile?.experience ?? existingCharacter.experience,
      },
    });
    return existingCharacter.id;
  }

  const created = await prisma.character.create({
    data: {
      userId: legacyUser.id,
      name: profile?.name ?? username,
      appearanceColor: profile?.appearanceColor ?? "#BD00FF",
      avatar: profile?.avatar ?? "bunny",
      description: profile?.description ?? null,
      wallet: profile?.wallet ?? 1000,
      arenaMaxRounds: profile?.arenaMaxRounds ?? 0,
      experience: profile?.experience ?? 0,
    },
  });

  return created.id;
}

export async function getCharacterById(characterId: string) {
  return prisma.character.findUnique({ where: { id: characterId } });
}

export async function getAvatarForUsername(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { character: true },
  });
  return user?.character?.avatar ?? "bunny";
}

export async function buyStockForCharacter(input: {
  characterId: string;
  symbol: string;
  quantity: number;
}) {
  const character = await prisma.character.findUnique({ where: { id: input.characterId } });
  if (!character) throw new Error("Character not found");

  const stock = await prisma.stock.findUnique({ where: { symbol: input.symbol } });
  if (!stock) throw new Error("Stock not found");

  const cost = stock.price * input.quantity;
  if (character.wallet < cost) {
    return { ok: false as const, reason: "INSUFFICIENT_FUNDS" as const, cost };
  }

  await prisma.$transaction([
    prisma.character.update({
      where: { id: input.characterId },
      data: { wallet: { decrement: cost } },
    }),
    prisma.portfolioItem.upsert({
      where: {
        characterId_stockId: {
          characterId: input.characterId,
          stockId: stock.id,
        },
      },
      create: {
        characterId: input.characterId,
        stockId: stock.id,
        quantity: input.quantity,
      },
      update: {
        quantity: { increment: input.quantity },
      },
    }),
  ]);

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
  const character = await prisma.character.findUnique({ where: { id: input.characterId } });
  if (!character) throw new Error("Character not found");

  const stock = await prisma.stock.findUnique({ where: { symbol: input.symbol } });
  if (!stock) throw new Error("Stock not found");

  const portfolioItem = await prisma.portfolioItem.findUnique({
    where: {
      characterId_stockId: {
        characterId: input.characterId,
        stockId: stock.id,
      },
    },
  });

  if (!portfolioItem || portfolioItem.quantity < input.quantity) {
    return { ok: false as const, reason: "NOT_ENOUGH_SHARES" as const };
  }

  const gain = stock.price * input.quantity;

  await prisma.$transaction([
    prisma.character.update({
      where: { id: input.characterId },
      data: { wallet: { increment: gain } },
    }),
    prisma.portfolioItem.update({
      where: { id: portfolioItem.id },
      data: { quantity: { decrement: input.quantity } },
    }),
  ]);

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
      await prisma.character.updateMany({
        where: { user: { username: input.winner } },
        data: { experience: { increment: 50 }, wallet: { increment: input.reward } },
      });
    }
    if (input.loser) {
      await prisma.character.updateMany({
        where: { user: { username: input.loser } },
        data: { experience: { increment: 10 } },
      });
    }
    return;
  }

  const playerUsername = input.winner ?? input.loser;
  if (!playerUsername) return;

  const character = await prisma.character.findFirst({
    where: { user: { username: playerUsername } },
  });
  if (!character) return;

  if (input.roundsReached > character.arenaMaxRounds) {
    await prisma.character.update({
      where: { id: character.id },
      data: { arenaMaxRounds: input.roundsReached },
    });
  }

  const now = new Date();
  const lastSolo = character.lastSoloArenaAt;
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
    await prisma.character.update({
      where: { id: character.id },
      data: {
        experience: { increment: 10 },
        lastSoloArenaAt: now,
      },
    });
  }
}
