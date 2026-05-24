import { oneOrNull, withTransaction } from "@/lib/db";

export async function buyBuildingLegacy(input: {
  buildingId: string;
  legacyCharacterId: string;
}) {
  const { buildingId, legacyCharacterId } = input;

  return withTransaction(async (tx) => {
    const building = await oneOrNull<any>('SELECT * FROM "BuildingState" WHERE "id" = $1 LIMIT 1', [buildingId], tx);

    if (!building) throw new Error("Building not found");
    if (!building.forSale) throw new Error("Building is not for sale");

    const buyerUpdate = await tx.query(
      'UPDATE "Character" SET "wallet" = "wallet" - $2 WHERE "id" = $1 AND "wallet" >= $2',
      [legacyCharacterId, building.price],
    );

    if (buyerUpdate.rowCount === 0) throw new Error("Not enough funds");

    if (building.ownerId) {
      await tx.query('UPDATE "Character" SET "wallet" = "wallet" + $2 WHERE "id" = $1', [building.ownerId, building.price]);
    } else {
      const townId = parseInt(building.townId, 10);
      await tx.query('UPDATE "Town" SET "bankBalance" = "bankBalance" + $2 WHERE "id" = $1', [townId, building.price]);
      await tx.query(
        'INSERT INTO "TreasuryLedgerEntry" ("townId", "kind", "amount", "referenceType", "referenceId", "metadataJson") VALUES ($1, $2, $3, $4, $5, $6)',
        [townId, "BUILDING_SALE_INFLOW", building.price, "BuildingState", building.id, JSON.stringify({ source: "buyBuilding" })],
      );
    }

    const buildingUpdate = await tx.query(
      'UPDATE "BuildingState" SET "ownerId" = $2, "forSale" = false WHERE "id" = $1 AND "forSale" = true AND "ownerId" IS NOT DISTINCT FROM $3',
      [buildingId, legacyCharacterId, building.ownerId],
    );

    if (buildingUpdate.rowCount === 0) {
      throw new Error("Building state changed unexpectedly during purchase");
    }

    const updatedBuyer = await oneOrNull<{ wallet: number }>('SELECT "wallet" FROM "Character" WHERE "id" = $1 LIMIT 1', [legacyCharacterId], tx);
    return { walletAfter: updatedBuyer?.wallet ?? null };
  });
}

export async function getBuildingById(buildingId: string) {
  return oneOrNull('SELECT * FROM "BuildingState" WHERE "id" = $1 LIMIT 1', [buildingId]);
}

export async function updateBuildingSettingsLegacy(
  buildingId: string,
  input: { title: string; price: number; forSale: boolean },
) {
  return oneOrNull(
    'UPDATE "BuildingState" SET "title" = $2, "price" = $3, "forSale" = $4 WHERE "id" = $1 RETURNING *',
    [buildingId, input.title, input.price, input.forSale],
  );
}
