"use server";

import { cookies } from "next/headers";
import { requireSessionUserWithCharacter } from "../../lib/auth";
import { AUTH_COOKIE_NAME, strapiMe, updatePlayerProfile } from "../../lib/strapiAuth";
import {
  buyBuildingState,
  getBuildingById,
  updateBuildingSettings as updateBuildingStateSettings,
  upgradeBuildingState,
} from "@/lib/bff/townService";

export async function buyBuilding(buildingId: string, townId?: string) {
  const user = await requireSessionUserWithCharacter();

  const characterId = user.character.id;
  const sessionToken = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (buildingId === "4") throw new Error("You cannot buy the Bank.");

  const result = await buyBuildingState({
    buildingId,
    characterId,
    townId,
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

export async function upgradeBuilding(buildingId: string, townId?: string) {
  const user = await requireSessionUserWithCharacter();

  const characterId = user.character.id;
  const sessionToken = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  const result = await upgradeBuildingState(buildingId, characterId, townId);

  if (sessionToken && typeof result.walletAfter === "number") {
    try {
      const me = await strapiMe(sessionToken);
      await updatePlayerProfile(sessionToken, me.id, { wallet: result.walletAfter });
    } catch (error) {
      console.error("Failed to sync Strapi wallet after upgradeBuilding", error);
    }
  }

  return { success: true };
}

export async function updateBuildingSettings(
  buildingId: string,
  townId: string,
  title: string,
  price: number,
  forSale: boolean,
) {
  const user = await requireSessionUserWithCharacter();

  const characterId = user.character.id;

  const building = await getBuildingById(buildingId, townId);

  if (!building) throw new Error("Building not found");
  const isOwner =
    building.ownerId === characterId ||
    building.ownerId === String(user.id);
  if (!isOwner) throw new Error("Not the owner");
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a non-negative number");

  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Title cannot be empty");

  await updateBuildingStateSettings(buildingId, townId, {
    title: normalizedTitle,
    price,
    forSale,
  });

  return { success: true };
}
