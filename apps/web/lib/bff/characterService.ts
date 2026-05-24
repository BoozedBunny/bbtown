import { randomUUID } from "crypto";
import { oneOrNull } from "@/lib/db";

export async function createLegacyCharacter(input: {
  name: string;
  appearanceColor: string;
  avatar: string;
  userId: string;
}) {
  return oneOrNull(
    'INSERT INTO "Character" ("id", "name", "appearanceColor", "avatar", "userId") VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [randomUUID(), input.name, input.appearanceColor, input.avatar, input.userId],
  );
}

export async function updateLegacyCharacterProfile(
  characterId: string,
  input: { name: string; avatar: string; description: string | null },
) {
  return oneOrNull(
    'UPDATE "Character" SET "name" = $2, "avatar" = $3, "description" = $4 WHERE "id" = $1 RETURNING *',
    [characterId, input.name, input.avatar, input.description],
  );
}

export async function incrementLegacyCharacterWallet(characterId: string, amount: number) {
  return oneOrNull(
    'UPDATE "Character" SET "wallet" = "wallet" + $2 WHERE "id" = $1 RETURNING *',
    [characterId, amount],
  );
}
