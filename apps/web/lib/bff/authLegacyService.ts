import { oneOrNull } from "@/lib/db";

export async function getLegacyUserByUsername(username: string) {
  return oneOrNull(
    `SELECT
      u.*,
      CASE WHEN c."id" IS NULL THEN NULL ELSE row_to_json(c) END AS "character"
    FROM "User" u
    LEFT JOIN "Character" c ON c."userId" = u."id"
    WHERE u."username" = $1
    LIMIT 1`,
    [username],
  );
}

const UUID_V4_OR_V1_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeUuid(value: string | null | undefined) {
  return typeof value === "string" && UUID_V4_OR_V1_LIKE_RE.test(value);
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
  if (looksLikeUuid(input.characterIdFromSession)) {
    const directCharacter = await oneOrNull<{ id: string }>('SELECT "id" FROM "Character" WHERE "id" = $1 LIMIT 1', [input.characterIdFromSession]);
    if (directCharacter) return directCharacter.id;
  }

  const legacyByUsername = await oneOrNull<{ id: string }>(
    'SELECT c."id" FROM "Character" c JOIN "User" u ON u."id" = c."userId" WHERE u."username" = $1 LIMIT 1',
    [input.username],
  );
  if (legacyByUsername) return legacyByUsername.id;

  throw new Error("Legacy character missing. Runtime now requires Strapi-first identities; no legacy auto-create.");
}
