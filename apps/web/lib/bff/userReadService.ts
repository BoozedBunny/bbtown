import { prisma } from "@/lib/prisma";

export async function getCharacterPublicProfileById(characterId: string) {
  return prisma.character.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      name: true,
      avatar: true,
      description: true,
      experience: true,
      arenaMaxRounds: true,
    },
  });
}
