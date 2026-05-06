"use server";

import { TreasuryLedgerKind } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getSessionUser } from "../../lib/auth";

export async function buyBuilding(buildingId: string) {
  const user = await getSessionUser();
  if (!user || !user.character) throw new Error("Unauthorized or no character");

  const character = user.character;

  if (buildingId === "4") throw new Error("You cannot buy the Bank.");

  const building = await prisma.buildingState.findUnique({
    where: { id: buildingId }
  });

  if (!building) throw new Error("Building not found");
  if (!building.forSale) throw new Error("Building is not for sale");
  if (character.wallet < building.price) throw new Error("Not enough funds");

  const transactions = [];

  // Deduct from buyer atomically only if funds are still available
  transactions.push(
    prisma.character.updateMany({
      where: { id: character.id, wallet: { gte: building.price } },
      data: { wallet: { decrement: building.price } }
    })
  );

  // If owned, transfer to seller. If unowned, transfer to town bank.
  if (building.ownerId) {
    transactions.push(
      prisma.character.update({
        where: { id: building.ownerId },
        data: { wallet: { increment: building.price } }
      })
    );
  } else {
    const townId = parseInt(building.townId);
    transactions.push(
      prisma.town.update({
        where: { id: townId },
        data: { bankBalance: { increment: building.price } }
      })
    );
    transactions.push(
      prisma.treasuryLedgerEntry.create({
        data: {
          townId,
          kind: TreasuryLedgerKind.BUILDING_SALE_INFLOW,
          amount: building.price,
          referenceType: "BuildingState",
          referenceId: building.id,
          metadataJson: JSON.stringify({ source: "buyBuilding" }),
        }
      })
    );
  }

  // Update building ownership and take it off the market only if still for sale
  transactions.push(
    prisma.buildingState.updateMany({
      where: { id: buildingId, forSale: true },
      data: { ownerId: character.id, forSale: false }
    })
  );

  const [buyerUpdate, , buildingUpdate] = await prisma.$transaction(transactions);

  if (buyerUpdate.count === 0) throw new Error("Not enough funds");
  if (buildingUpdate.count === 0) throw new Error("Building is not for sale");

  return { success: true };
}

export async function updateBuildingSettings(buildingId: string, title: string, price: number, forSale: boolean) {
  const user = await getSessionUser();
  if (!user || !user.character) throw new Error("Unauthorized");

  const building = await prisma.buildingState.findUnique({
    where: { id: buildingId }
  });

  if (!building) throw new Error("Building not found");
  if (building.ownerId !== user.character.id) throw new Error("Not the owner");
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a non-negative number");

  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Title cannot be empty");

  await prisma.buildingState.update({
    where: { id: buildingId },
    data: { title: normalizedTitle, price, forSale }
  });

  return { success: true };
}
