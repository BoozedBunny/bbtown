"use server";

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

  // Deduct from buyer
  transactions.push(
    prisma.character.update({
      where: { id: character.id },
      data: { wallet: character.wallet - building.price }
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
    transactions.push(
      prisma.town.update({
        where: { id: parseInt(building.townId) },
        data: { bankBalance: { increment: building.price } }
      })
    );
  }

  // Update building ownership and take it off the market
  transactions.push(
    prisma.buildingState.update({
      where: { id: buildingId },
      data: { ownerId: character.id, forSale: false }
    })
  );

  await prisma.$transaction(transactions);

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

  await prisma.buildingState.update({
    where: { id: buildingId },
    data: { title, price, forSale }
  });

  return { success: true };
}
