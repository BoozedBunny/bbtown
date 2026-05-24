import { oneOrNull } from "@/lib/db";

type CharacterPublicProfile = {
  id: string;
  name: string;
  avatar: string;
  description: string | null;
  experience: number;
  arenaMaxRounds: number;
};

export async function getCharacterPublicProfileById(characterId: string): Promise<CharacterPublicProfile | null> {
  return oneOrNull<CharacterPublicProfile>(
    'SELECT "id", "name", "avatar", "description", "experience", "arenaMaxRounds" FROM "Character" WHERE "id" = $1 LIMIT 1',
    [characterId],
  );
}
