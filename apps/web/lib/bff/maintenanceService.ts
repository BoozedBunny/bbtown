import { toUtcDateKey } from "../treasury/utils";
import { logTransaction } from "./ledgerService";
import { removeItemsFromInventory } from "./inventoryService";
import { sendSystemMail } from "./mailService";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

function getStrapiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {}),
  };
}

export interface MaintenanceRequirement {
  items: Record<string, number>;
  income: number;
}

export const MAINTENANCE_CONFIG: Record<number, MaintenanceRequirement> = {
  0: {
    items: {},
    income: 0,
  },
  1: {
    items: {
      alcohol: 1,
      condoms: 1,
      soap: 1,
    },
    income: 250,
  },
  2: {
    items: {
      alcohol: 2,
      condoms: 2,
      soap: 2,
      candles: 1,
      lube: 1,
      perfumes: 1,
    },
    income: 750,
  },
  3: {
    items: {
      alcohol: 4,
      condoms: 4,
      soap: 4,
      candles: 2,
      lube: 2,
      perfumes: 2,
      furniture: 1,
      disinfectant: 1,
      lingerie: 1,
    },
    income: 2000,
  },
};

const SPECIAL_BUILDINGS = ["21", "24", "25", "26"];

export async function runBuildingMaintenanceAndPartyIncomeSweep(now = new Date()): Promise<boolean> {
  const headers = getStrapiHeaders();
  
  try {
    // 1. Fetch all building states where an owner is assigned
    const url = new URL(`${STRAPI_BASE_URL}/api/building-states`);
    url.searchParams.set("filters[owner][$notNull]", "true");
    url.searchParams.set("populate[owner][fields][0]", "id");
    url.searchParams.set("populate[owner][fields][1]", "documentId");
    url.searchParams.set("populate[owner][fields][2]", "wallet");
    url.searchParams.set("populate[owner][fields][3]", "username");
    url.searchParams.set("pagination[limit]", "100");

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      console.error(`[maintenance] Failed to fetch owned building-states: ${res.status}`);
      return false;
    }
    const payload = await res.json();
    const buildings = payload.data ?? [];

    if (buildings.length === 0) return false;

    const today = toUtcDateKey(now);
    let sweptAny = false;

    for (const b of buildings) {
      const owner = b.owner;
      if (!owner) continue;

      const ownerDocId = owner.documentId ?? String(owner.id);
      
      // Extract building identifier (stateId format is townId:buildingId)
      const buildingId = b.stateId ? b.stateId.split(":")[1] : String(b.id);
      if (SPECIAL_BUILDINGS.includes(buildingId)) continue; // Skip Arena, Casino, Stock Exchange, Bank

      const level = Number(b.buildingLevel ?? 0);
      if (level <= 0) continue; // Level 0 requires no goods and gives no income

      const lastSwept = b.lastSweptDateKey;
      if (lastSwept === today) continue; // Already swept today

      // Get configuration for this level
      const config = MAINTENANCE_CONFIG[level] || MAINTENANCE_CONFIG[0];
      if (config.income <= 0) continue;

      // Fetch player's inventory items to inspect in-stock levels
      const invUrl = new URL(`${STRAPI_BASE_URL}/api/inventory-items`);
      invUrl.searchParams.set("filters[playerProfile][documentId][$eq]", ownerDocId);
      invUrl.searchParams.set("populate", "item");
      invUrl.searchParams.set("pagination[limit]", "500");
      
      const invRes = await fetch(invUrl, { headers, cache: "no-store" });
      if (!invRes.ok) {
        console.error(`[maintenance] Failed to fetch inventory for player: ${ownerDocId}`);
        continue;
      }
      const invPayload = await invRes.json();
      const inventoryItems = invPayload.data ?? [];

      // Sum quantities per item key
      const itemQuantities: Record<string, number> = {};
      for (const item of inventoryItems) {
        const key = item.item?.key;
        if (key) {
          itemQuantities[key] = (itemQuantities[key] || 0) + Number(item.quantity ?? 0);
        }
      }

      // Verify if player is delinquent (missing even a single commodity)
      let isDelinquent = false;
      for (const [reqKey, reqQty] of Object.entries(config.items)) {
        const available = itemQuantities[reqKey] || 0;
        if (available < reqQty) {
          isDelinquent = true;
          break;
        }
      }

      let earnedIncome = config.income;
      let description = `Party income: ${b.title} Level ${level}`;

      if (isDelinquent) {
        // 90% revenue cut
        earnedIncome = Math.round(config.income * 0.1);
        description = `Party income (10% delinquency penalty): ${b.title} Level ${level}`;
      } else {
        // Deduct goods from storage
        try {
          for (const [reqKey, reqQty] of Object.entries(config.items)) {
            await removeItemsFromInventory(ownerDocId, reqKey, reqQty);
          }
        } catch (err) {
          console.error(`[maintenance] Failed to deduct items for ${owner.username}, marked delinquent:`, err);
          isDelinquent = true;
          earnedIncome = Math.round(config.income * 0.1);
          description = `Party income (10% delinquency penalty): ${b.title} Level ${level}`;
        }
      }

      // Credit player wallet
      const currentWallet = Number(owner.wallet ?? 0);
      const newWallet = currentWallet + earnedIncome;

      const updateProfileUrl = `${STRAPI_BASE_URL}/api/player-profiles/${ownerDocId}`;
      const updateRes = await fetch(updateProfileUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { wallet: newWallet } }),
      });

      if (!updateRes.ok) {
        console.error(`[maintenance] Failed to credit wallet for player: ${ownerDocId}`);
        continue;
      }

      // Log transaction entry
      await logTransaction(ownerDocId, earnedIncome, "PARTY", description);

      // Dispatch Daily Sweep Mail Message
      const mailSubject = isDelinquent 
        ? `Daily Party Sweep (DELINQUENT): ${b.title}`
        : `Daily Party Sweep Successful: ${b.title}`;
      
      const mailBody = isDelinquent
        ? `Your property ${b.title} (Level ${level}) failed its daily goods sweep due to missing commodities in stock.\n\nA delinquency penalty has been active today:\n- Wallet Payout: +$${earnedIncome} credits (90% Revenue Penalty Applied)\n- Status: Delinquent\n\n⚠️ Missing items: ${Object.entries(config.items).map(([key, qty]) => `${qty}x ${key}`).join(", ")}. Please purchase goods in the Wholesale Harbours import catalog to recover full profits.`
        : `Your property ${b.title} (Level ${level}) successfully hosted a party today.\n\nThe daily maintenance sweep has completed successfully:\n- Consumed commodities: ${Object.entries(config.items).map(([key, qty]) => `${qty}x ${key}`).join(", ")}\n- Wallet Payout: +$${earnedIncome} credits\n- Status: Operational`;

      await sendSystemMail(ownerDocId, mailSubject, mailBody, "SYSTEM");

      // Lock sweeps for today
      const buildingDocId = b.documentId ?? String(b.id);
      const updateBuildingUrl = `${STRAPI_BASE_URL}/api/building-states/${buildingDocId}`;
      await fetch(updateBuildingUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { lastSweptDateKey: today } }),
      });

      console.log(`[maintenance] Swept building ${b.title} (Level ${level}) for player ${owner.username}. Delinquent: ${isDelinquent}, Earned: $${earnedIncome}`);
      sweptAny = true;
    }

    return sweptAny;
  } catch (error) {
    console.error("[maintenance] Failed running daily buildings maintenance sweep:", error);
    return false;
  }
}
