"use server";

import { prisma } from "../../lib/prisma";
import { getSessionUser } from "../../lib/auth";

export async function buyBuilding(buildingId: string) {
  const user = await getSessionUser();
  if (!user || !user.character) throw new Error("Unauthorized or no character");

  const character = user.character;

  const building = await prisma.buildingState.findUnique({
    where: { id: buildingId }
  });

  if (!building) throw new Error("Building not found");
  if (building.ownerId) throw new Error("Building already owned");
  if (character.wallet < building.price) throw new Error("Not enough funds");

  await prisma.$transaction([
    prisma.character.update({
      where: { id: character.id },
      data: { wallet: character.wallet - building.price }
    }),
    prisma.buildingState.update({
      where: { id: buildingId },
      data: { ownerId: character.id }
    })
  ]);

  return { success: true };
}
