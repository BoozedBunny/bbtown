"use server";

import { cookies } from "next/headers";
import { ensureLegacyCharacterForSession, requireSessionUserWithCharacter } from "../../lib/auth";
import { AUTH_COOKIE_NAME, strapiMe, updatePlayerProfile } from "../../lib/strapiAuth";
import {
  buyBuildingLegacy,
  getBuildingById,
  updateBuildingSettingsLegacy,
} from "@/lib/bff/townService";

export async function buyBuilding(buildingId: string) {
  const user = await requireSessionUserWithCharacter();

  const legacyCharacterId = await ensureLegacyCharacterForSession(user);
  const sessionToken = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (buildingId === "4") throw new Error("You cannot buy the Bank.");

  const result = await buyBuildingLegacy({
    buildingId,
    legacyCharacterId,
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

  const legacyCharacterId = await ensureLegacyCharacterForSession(user);

  const building = await getBuildingById(buildingId);

  if (!building) throw new Error("Building not found");
  if (building.ownerId !== legacyCharacterId) throw new Error("Not the owner");
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a non-negative number");

  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Title cannot be empty");

  await updateBuildingSettingsLegacy(buildingId, {
    title: normalizedTitle,
    price,
    forSale,
  });

  return { success: true };
}
