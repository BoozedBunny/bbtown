"use server";

import { cookies } from "next/headers";
import { TreasuryLedgerKind } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ensureLegacyCharacterForSession, getSessionUser } from "../../lib/auth";
import { AUTH_COOKIE_NAME, strapiMe, updatePlayerProfile } from "../../lib/strapiAuth";

export async function buyBuilding(buildingId: string) {
  const user = await getSessionUser();
  if (!user || !user.character) throw new Error("Unauthorized or no character");

  const legacyCharacterId = await ensureLegacyCharacterForSession(user);
  const sessionToken = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (buildingId === "4") throw new Error("You cannot buy the Bank.");

  const result = await prisma.$transaction(async (tx) => {
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

  if (sessionToken && typeof result.walletAfter === "number") {
    try {
      const me = await strapiMe(sessionToken);
      await updatePlayerProfile(sessionToken, me.id, { wallet: result.walletAfter });
    } catch (error) {
      console.error("Failed to sync Strapi wallet after buyBuilding", error);
    }
  }

  return { success: true };
}

export async function updateBuildingSettings(buildingId: string, title: string, price: number, forSale: boolean) {
  const user = await getSessionUser();
  if (!user || !user.character) throw new Error("Unauthorized");

  const legacyCharacterId = await ensureLegacyCharacterForSession(user);

  const building = await prisma.buildingState.findUnique({
    where: { id: buildingId }
  });

  if (!building) throw new Error("Building not found");
  if (building.ownerId !== legacyCharacterId) throw new Error("Not the owner");
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a non-negative number");

  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Title cannot be empty");

  await prisma.buildingState.update({
    where: { id: buildingId },
    data: { title: normalizedTitle, price, forSale }
  });

  return { success: true };
}
