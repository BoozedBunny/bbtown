import { prisma } from "@/lib/prisma";

export async function createLegacyCharacter(input: {
  name: string;
  appearanceColor: string;
  avatar: string;
  userId: string;
}) {
  return prisma.character.create({
    data: {
      name: input.name,
      appearanceColor: input.appearanceColor,
      avatar: input.avatar,
      userId: input.userId,
    },
  });
}

export async function updateLegacyCharacterProfile(
  characterId: string,
  input: { name: string; avatar: string; description: string | null },
) {
  return prisma.character.update({
    where: { id: characterId },
    data: {
      name: input.name,
      avatar: input.avatar,
      description: input.description,
    },
  });
}

export async function incrementLegacyCharacterWallet(characterId: string, amount: number) {
  return prisma.character.update({
    where: { id: characterId },
    data: { wallet: { increment: amount } },
  });
}
