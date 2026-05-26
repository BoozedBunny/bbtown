"use server";

import { cookies } from "next/headers";
import { requireSessionUserWithCharacter } from "../../lib/auth";
import { AUTH_COOKIE_NAME, strapiMe, updatePlayerProfile } from "../../lib/strapiAuth";
import {
  buyBuildingState,
  getBuildingById,
  updateBuildingSettings as updateBuildingStateSettings,
} from "@/lib/bff/townService";

export async function buyBuilding(buildingId: string) {
  const user = await requireSessionUserWithCharacter();

  const characterId = user.character.id;
  const sessionToken = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (buildingId === "4") throw new Error("You cannot buy the Bank.");

  const result = await buyBuildingState({
    buildingId,
    characterId,
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
  const user = await requireSessionUserWithCharacter();

  const characterId = user.character.id;

  const building = await getBuildingById(buildingId);

  if (!building) throw new Error("Building not found");
  if (building.ownerId !== characterId) throw new Error("Not the owner");
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a non-negative number");

  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Title cannot be empty");

  await updateBuildingStateSettings(buildingId, {
    title: normalizedTitle,
    price,
    forSale,
  });

  return { success: true };
}
