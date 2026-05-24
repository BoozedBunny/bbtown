import { many, oneOrNull } from "@/lib/db";

export async function getPortfolioForCharacter(characterId: string) {
  return many(
    `SELECT
      p."id",
      p."characterId",
      p."stockId",
      p."quantity",
      json_build_object(
        'id', s."id",
        'symbol', s."symbol",
        'name', s."name",
        'price', s."price",
        'previousPrice', s."previousPrice",
        'updatedAt', s."updatedAt"
      ) AS "stock"
    FROM "PortfolioItem" p
    JOIN "Stock" s ON s."id" = p."stockId"
    WHERE p."characterId" = $1`,
    [characterId],
  );
}

export async function getTownStateById(townId: string) {
  const [buildings, town] = await Promise.all([
    many(
      `SELECT
        b."id",
        b."townId",
        b."title",
        b."forSale",
        b."price",
        b."employees",
        b."ownerId",
        CASE WHEN c."id" IS NULL THEN NULL ELSE json_build_object('name', c."name", 'avatar', c."avatar") END AS "owner"
      FROM "BuildingState" b
      LEFT JOIN "Character" c ON c."id" = b."ownerId"
      WHERE b."townId" = $1`,
      [townId],
    ),
    oneOrNull('SELECT "id", "name", "bankBalance" FROM "Town" WHERE "id" = $1 LIMIT 1', [parseInt(townId, 10)]),
  ]);

  return { buildings, town };
}
