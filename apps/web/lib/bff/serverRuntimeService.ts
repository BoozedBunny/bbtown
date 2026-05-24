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
