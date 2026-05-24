import { prisma } from "@/lib/prisma";

export async function getLegacyUserByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    include: { character: true },
  });
}

export async function ensureLegacyCharacterFromSessionShape(input: {
  characterIdFromSession: string;
  username: string;
  character: {
    name: string;
    avatar: string;
    description: string | null;
    wallet: number;
    arenaMaxRounds: number;
    experience: number;
    appearanceColor?: string;
    loanStatus?: "NONE" | "ACTIVE" | "DELINQUENT";
    loanLockedUntil?: Date | null;
    lastSoloArenaAt?: Date | null;
  };
}) {
  const directCharacter = await prisma.character.findUnique({ where: { id: input.characterIdFromSession } });
  if (directCharacter) return directCharacter.id;

  const legacyUser = await prisma.user.upsert({
    where: { username: input.username },
    update: {},
    create: { username: input.username },
  });

  const existingByUser = await prisma.character.findUnique({ where: { userId: legacyUser.id } });
  if (existingByUser) {
    await prisma.character.update({
      where: { id: existingByUser.id },
      data: {
        name: input.character.name,
        appearanceColor: input.character.appearanceColor ?? "#BD00FF",
        avatar: input.character.avatar,
        description: input.character.description,
        wallet: input.character.wallet,
        arenaMaxRounds: input.character.arenaMaxRounds,
        experience: input.character.experience,
      },
    });
    return existingByUser.id;
  }

  const created = await prisma.character.create({
    data: {
      userId: legacyUser.id,
      name: input.character.name,
      appearanceColor: input.character.appearanceColor ?? "#BD00FF",
      avatar: input.character.avatar,
      description: input.character.description,
      wallet: input.character.wallet,
      arenaMaxRounds: input.character.arenaMaxRounds,
      experience: input.character.experience,
      loanStatus: input.character.loanStatus ?? "NONE",
      loanLockedUntil: input.character.loanLockedUntil ?? null,
      lastSoloArenaAt: input.character.lastSoloArenaAt ?? null,
    },
  });

  return created.id;
}
