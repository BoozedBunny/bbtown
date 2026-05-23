import { prisma } from "@/lib/prisma";

export async function getPortfolioForCharacter(characterId: string) {
  return prisma.portfolioItem.findMany({
    where: { characterId },
    include: { stock: true },
  });
}

export async function getTownStateById(townId: string) {
  const [buildings, town] = await Promise.all([
    prisma.buildingState.findMany({
      where: { townId },
      include: {
        owner: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
    }),
    prisma.town.findUnique({ where: { id: parseInt(townId, 10) } }),
  ]);

  return { buildings, town };
}
