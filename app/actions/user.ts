"use server";

import { getSessionUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

export async function getCurrentUser() {
  const user = await getSessionUser();
  if (!user || !user.character) return null;
  return {
    id: user.id,
    username: user.username,
    character: {
      id: user.character.id,
      name: user.character.name,
      avatar: user.character.avatar,
      description: user.character.description,
      wallet: user.character.wallet,
      arenaMaxRounds: user.character.arenaMaxRounds,
      experience: user.character.experience,
    },
  };
}

export async function getCharacterProfile(characterId: string) {
  const user = await getSessionUser();
  if (!user || !user.character) throw new Error("Unauthorized");

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      name: true,
      avatar: true,
      description: true,
      experience: true,
    },
  });

  if (!character) {
    throw new Error("Character not found");
  }

  return character;
}
