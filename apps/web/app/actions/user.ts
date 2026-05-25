"use server";

import { requireSessionUserWithCharacter } from "../../lib/auth";
import { getCharacterPublicProfileById } from "@/lib/bff/userReadService";

export async function getCurrentUser() {
  const user = await requireSessionUserWithCharacter();
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
  const user = await requireSessionUserWithCharacter();

  if (String(user.character.id) === String(characterId)) {
    return {
      id: user.character.id,
      name: user.character.name,
      avatar: user.character.avatar,
      description: user.character.description,
      experience: user.character.experience,
      arenaMaxRounds: user.character.arenaMaxRounds,
    };
  }

  const character = await getCharacterPublicProfileById(characterId);

  if (!character) {
    throw new Error("Character not found");
  }

  return character;
}
