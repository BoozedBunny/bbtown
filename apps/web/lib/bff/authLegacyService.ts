import { randomUUID } from "crypto";
import { oneOrNull } from "@/lib/db";
import { getRuntimeFlags } from "@/lib/config/runtimeFlags";

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
  const flags = getRuntimeFlags();

  if (looksLikeUuid(input.characterIdFromSession)) {
    const directCharacter = await oneOrNull<{ id: string }>('SELECT "id" FROM "Character" WHERE "id" = $1 LIMIT 1', [input.characterIdFromSession]);
    if (directCharacter) return directCharacter.id;
  }

  if (!flags.legacyWriteEnabled || flags.strapiSotMode === "on") {
    throw new Error("Legacy character missing while legacy writes are disabled (STRAPI_SOT_MODE=on)");
  }

  const legacyUser = await oneOrNull<{ id: string }>(
    'INSERT INTO "User" ("id", "username", "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT ("username") DO UPDATE SET "username" = EXCLUDED."username", "updatedAt" = NOW() RETURNING "id"',
    [randomUUID(), input.username],
  );
  if (!legacyUser) throw new Error("Failed to upsert legacy user");

  const existingByUser = await oneOrNull<{ id: string }>('SELECT "id" FROM "Character" WHERE "userId" = $1 LIMIT 1', [legacyUser.id]);
  if (existingByUser) {
    await oneOrNull(
      'UPDATE "Character" SET "name" = $2, "appearanceColor" = $3, "avatar" = $4, "description" = $5, "wallet" = $6, "arenaMaxRounds" = $7, "experience" = $8 WHERE "id" = $1 RETURNING "id"',
      [
        existingByUser.id,
        input.character.name,
        input.character.appearanceColor ?? "#BD00FF",
        input.character.avatar,
        input.character.description,
        input.character.wallet,
        input.character.arenaMaxRounds,
        input.character.experience,
      ],
    );
    return existingByUser.id;
  }

  const created = await oneOrNull<{ id: string }>(
    'INSERT INTO "Character" ("id", "userId", "name", "appearanceColor", "avatar", "description", "wallet", "arenaMaxRounds", "experience", "loanStatus", "loanLockedUntil", "lastSoloArenaAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING "id"',
    [
      randomUUID(),
      legacyUser.id,
      input.character.name,
      input.character.appearanceColor ?? "#BD00FF",
      input.character.avatar,
      input.character.description,
      input.character.wallet,
      input.character.arenaMaxRounds,
      input.character.experience,
      input.character.loanStatus ?? "NONE",
      input.character.loanLockedUntil ?? null,
      input.character.lastSoloArenaAt ?? null,
    ],
  );

  if (!created) throw new Error("Failed to create legacy character");
  return created.id;
}
