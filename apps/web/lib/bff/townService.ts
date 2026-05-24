import { TreasuryLedgerKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function buyBuildingLegacy(input: {
  buildingId: string;
  legacyCharacterId: string;
}) {
  const { buildingId, legacyCharacterId } = input;

  return prisma.$transaction(async (tx) => {
    const building = await tx.buildingState.findUnique({ where: { id: buildingId } });

    if (!building) throw new Error("Building not found");
    if (!building.forSale) throw new Error("Building is not for sale");

    const buyerUpdate = await tx.character.updateMany({
      where: { id: legacyCharacterId, wallet: { gte: building.price } },
      data: { wallet: { decrement: building.price } },
    });

    if (buyerUpdate.count === 0) throw new Error("Not enough funds");

    if (building.ownerId) {
      await tx.character.update({
        where: { id: building.ownerId },
        data: { wallet: { increment: building.price } },
      });
    } else {
      const townId = parseInt(building.townId, 10);
      await tx.town.update({
        where: { id: townId },
        data: { bankBalance: { increment: building.price } },
      });
      await tx.treasuryLedgerEntry.create({
        data: {
          townId,
          kind: TreasuryLedgerKind.BUILDING_SALE_INFLOW,
          amount: building.price,
          referenceType: "BuildingState",
          referenceId: building.id,
          metadataJson: JSON.stringify({ source: "buyBuilding" }),
        },
      });
    }

    const buildingUpdate = await tx.buildingState.updateMany({
      where: {
        id: buildingId,
        forSale: true,
        ownerId: building.ownerId,
      },
      data: { ownerId: legacyCharacterId, forSale: false },
    });

    if (buildingUpdate.count === 0) {
      throw new Error("Building state changed unexpectedly during purchase");
    }

    const updatedBuyer = await tx.character.findUnique({ where: { id: legacyCharacterId } });
    return { walletAfter: updatedBuyer?.wallet ?? null };
  });
}

export async function getBuildingById(buildingId: string) {
  return prisma.buildingState.findUnique({ where: { id: buildingId } });
}

export async function updateBuildingSettingsLegacy(
  buildingId: string,
  input: { title: string; price: number; forSale: boolean },
) {
  return prisma.buildingState.update({
    where: { id: buildingId },
    data: {
      title: input.title,
      price: input.price,
      forSale: input.forSale,
    },
  });
}
