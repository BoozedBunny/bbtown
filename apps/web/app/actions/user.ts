"use server";

import { requireSessionUserWithCharacter } from "../../lib/auth";
import { getCharacterPublicProfileById } from "@/lib/bff/userReadService";

export async function getCurrentUser() {
  const user = await requireSessionUserWithCharacter();
  if (!user || !user.character) return null;
  return {
    id: user.id,
    username: user.username,
    character: {
      id: user.character.id,
      name: user.character.name,
      avatar: user.character.avatar,
      description: user.character.description,
      wallet: user.character.wallet,
      arenaMaxRounds: user.character.arenaMaxRounds,
      experience: user.character.experience,
    },
  };
}

export async function getCharacterProfile(characterId: string) {
  const user = await requireSessionUserWithCharacter();

  let profileData: any = null;

  if (String(user.character.id) === String(characterId)) {
    profileData = {
      id: user.character.id,
      name: user.character.name,
      avatar: user.character.avatar,
      description: user.character.description,
      experience: user.character.experience,
      arenaMaxRounds: user.character.arenaMaxRounds,
    };
  } else {
    const character = await getCharacterPublicProfileById(characterId);
    if (!character) {
      throw new Error("Character not found");
    }
    profileData = { ...character };
  }

  try {
    const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
    const token = process.env.STRAPI_API_TOKEN;
    if (token) {
      const stockRes = await fetch(
        `${STRAPI_BASE_URL}/api/stocks?filters[owner][documentId][$eq]=${encodeURIComponent(characterId)}&pagination[limit]=1`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        if (stockData.data && stockData.data.length > 0) {
          profileData.ownedStockSymbol = stockData.data[0].symbol;
        }
      }
    }
  } catch (err) {
    console.error("Error fetching owned stock for profile modal:", err);
  }

  return profileData;
}
