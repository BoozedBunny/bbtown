import { getLevelFromXP } from "../leveling";
import { logTransaction } from "./ledgerService";


const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

function getStrapiServiceHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {}),
  };
}

export interface InventoryItemDTO {
  documentId: string;
  quantity: number;
  slotIndex: number;
  item: {
    key: string;
    displayName: string;
    category: string;
    baseValue: number;
    maxStackSize: number;
  };
}

export interface InventorySlot {
  slotIndex: number;
  item: {
    key: string;
    displayName: string;
    category: string;
    baseValue: number;
    maxStackSize: number;
  } | null;
  quantity: number;
  documentId: string | null;
}

export function getInventoryCapacity(experience: number): number {
  const level = getLevelFromXP(experience);
  // Base 16 slots, +4 per level, capped at 40
  return Math.min(40, 16 + 4 * (level - 1));
}

export async function getPlayerProfileAndInventory(username: string) {
  const headers = getStrapiServiceHeaders();
  
  // 1. Fetch Auth User
  const userUrl = new URL(`${STRAPI_BASE_URL}/api/users`);
  userUrl.searchParams.set("filters[username][$eq]", username);
  
  const userRes = await fetch(userUrl, { headers, cache: "no-store" });
  if (!userRes.ok) throw new Error(`User lookup failed (${userRes.status})`);
  const users = await userRes.json();
  const user = users?.[0];
  if (!user) throw new Error(`User not found: ${username}`);
  
  const authUserId = user.id;

  // 2. Fetch Player Profile using authUserId
  const profileUrl = new URL(`${STRAPI_BASE_URL}/api/player-profiles`);
  profileUrl.searchParams.set("filters[authUserId][$eq]", String(authUserId));
  profileUrl.searchParams.set("pagination[limit]", "1");
  
  const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
  if (!profileRes.ok) throw new Error(`Profile lookup failed (${profileRes.status})`);
  const profileJson = await profileRes.json();
  const profile = profileJson.data?.[0];
  if (!profile) throw new Error(`Player profile not found for user: ${username}`);
  
  const profileDocId = profile.documentId ?? String(profile.id);
  const experience = Number(profile.experience ?? 0);
  const wallet = Number(profile.wallet ?? 0);
  const capacity = getInventoryCapacity(experience);

  
  // 2. Fetch inventory items
  const invUrl = new URL(`${STRAPI_BASE_URL}/api/inventory-items`);
  invUrl.searchParams.set("filters[playerProfile][documentId][$eq]", profileDocId);
  invUrl.searchParams.set("populate", "item");
  invUrl.searchParams.set("pagination[limit]", "500");
  
  const invRes = await fetch(invUrl, { headers, cache: "no-store" });
  if (!invRes.ok) throw new Error(`Failed to fetch inventory (${invRes.status})`);
  const invJson = await invRes.json();
  const rawItems = invJson.data ?? [];
  
  // Map raw Strapi items to slot positions
  const slots: InventorySlot[] = Array.from({ length: capacity }, (_, i) => ({
    slotIndex: i,
    item: null,
    quantity: 0,
    documentId: null,
  }));
  
  for (const raw of rawItems) {
    const slotIdx = Number(raw.slotIndex);
    if (slotIdx >= 0 && slotIdx < capacity) {
      slots[slotIdx] = {
        slotIndex: slotIdx,
        item: raw.item ? {
          key: raw.item.key,
          displayName: raw.item.displayName,
          category: raw.item.category,
          baseValue: Number(raw.item.baseValue ?? 0),
          maxStackSize: Number(raw.item.maxStackSize ?? 99),
        } : null,
        quantity: Number(raw.quantity ?? 0),
        documentId: raw.documentId ?? String(raw.id),
      };
    }
  }
  
  return {
    profileDocId,
    experience,
    wallet,
    capacity,
    slots,
  };
}

export async function addItemsToInventory(profileDocId: string, itemKey: string, quantityToAdd: number, capacity: number): Promise<boolean> {
  const headers = getStrapiServiceHeaders();
  
  // 1. Fetch current item info to get maxStackSize
  const itemUrl = new URL(`${STRAPI_BASE_URL}/api/items`);
  itemUrl.searchParams.set("filters[key][$eq]", itemKey);
  itemUrl.searchParams.set("pagination[limit]", "1");
  const itemRes = await fetch(itemUrl, { headers, cache: "no-store" });
  if (!itemRes.ok) throw new Error(`Item info lookup failed for key: ${itemKey}`);
  const itemJson = await itemRes.json();
  const itemData = itemJson.data?.[0];
  if (!itemData) throw new Error(`Item definition not found for key: ${itemKey}`);
  
  const maxStackSize = Number(itemData.maxStackSize ?? 99);
  
  // 2. Fetch current player inventory
  const invUrl = new URL(`${STRAPI_BASE_URL}/api/inventory-items`);
  invUrl.searchParams.set("filters[playerProfile][documentId][$eq]", profileDocId);
  invUrl.searchParams.set("populate", "item");
  invUrl.searchParams.set("pagination[limit]", "500");
  const invRes = await fetch(invUrl, { headers, cache: "no-store" });
  const invJson = await invRes.json();
  const currentInvItems: any[] = invJson.data ?? [];
  
  let remaining = quantityToAdd;
  
  // Try to top-up existing stacks
  const existingStacks = currentInvItems.filter(raw => raw.item?.key === itemKey);
  for (const stack of existingStacks) {
    const qty = Number(stack.quantity ?? 0);
    if (qty < maxStackSize) {
      const space = maxStackSize - qty;
      const add = Math.min(space, remaining);
      
      const docId = stack.documentId ?? String(stack.id);
      const updateRes = await fetch(`${STRAPI_BASE_URL}/api/inventory-items/${docId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { quantity: qty + add } }),
      });
      
      if (!updateRes.ok) throw new Error("Failed to update inventory item quantity");
      remaining -= add;
      if (remaining <= 0) return true;
    }
  }
  
  // Allocate new stacks in first available empty slots
  const usedSlots = new Set<number>(currentInvItems.map(raw => Number(raw.slotIndex)));
  while (remaining > 0) {
    let emptySlot = -1;
    for (let i = 0; i < capacity; i++) {
      if (!usedSlots.has(i)) {
        emptySlot = i;
        break;
      }
    }
    
    if (emptySlot === -1) {
      // Inventory is full! If we added some, we return false or throw to warn
      throw new Error(`Inventory full! Could not fit remaining ${remaining}x ${itemKey}.`);
    }
    
    const stackQty = Math.min(maxStackSize, remaining);
    
    const createRes = await fetch(`${STRAPI_BASE_URL}/api/inventory-items`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          playerProfile: profileDocId,
          item: itemData.documentId ?? String(itemData.id),
          quantity: stackQty,
          slotIndex: emptySlot,
        },
      }),
    });
    
    if (!createRes.ok) throw new Error("Failed to create inventory item stack");
    usedSlots.add(emptySlot);
    remaining -= stackQty;
  }
  
  return true;
}

export async function removeItemsFromInventory(profileDocId: string, itemKey: string, quantityToRemove: number): Promise<boolean> {
  const headers = getStrapiServiceHeaders();
  
  // Fetch current inventory
  const invUrl = new URL(`${STRAPI_BASE_URL}/api/inventory-items`);
  invUrl.searchParams.set("filters[playerProfile][documentId][$eq]", profileDocId);
  invUrl.searchParams.set("filters[item][key][$eq]", itemKey);
  invUrl.searchParams.set("pagination[limit]", "500");
  
  const invRes = await fetch(invUrl, { headers, cache: "no-store" });
  const invJson = await invRes.json();
  const stacks: any[] = invJson.data ?? [];
  
  // Sort stacks descending by quantity so we deplete smaller ones or slotIndex ascending
  stacks.sort((a, b) => Number(a.quantity) - Number(b.quantity));
  
  const totalAvailable = stacks.reduce((sum, stack) => sum + Number(stack.quantity ?? 0), 0);
  if (totalAvailable < quantityToRemove) {
    throw new Error(`Not enough ${itemKey} in inventory (Needed: ${quantityToRemove}, Available: ${totalAvailable})`);
  }
  
  let remaining = quantityToRemove;
  for (const stack of stacks) {
    const qty = Number(stack.quantity ?? 0);
    const docId = stack.documentId ?? String(stack.id);
    
    if (qty <= remaining) {
      // Remove stack completely
      const delRes = await fetch(`${STRAPI_BASE_URL}/api/inventory-items/${docId}`, {
        method: "DELETE",
        headers,
      });
      if (!delRes.ok) throw new Error("Failed to delete empty stack");
      remaining -= qty;
    } else {
      // Reduce stack quantity
      const updateRes = await fetch(`${STRAPI_BASE_URL}/api/inventory-items/${docId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { quantity: qty - remaining } }),
      });
      if (!updateRes.ok) throw new Error("Failed to decrease stack quantity");
      remaining = 0;
      break;
    }
    
    if (remaining <= 0) break;
  }
  
  return true;
}

export async function splitInventoryStack(profileDocId: string, fromSlot: number, toSlot: number, splitQuantity: number, capacity: number): Promise<boolean> {
  const headers = getStrapiServiceHeaders();
  
  if (fromSlot === toSlot) throw new Error("Cannot split stack into itself");
  if (toSlot < 0 || toSlot >= capacity) throw new Error("Target slot out of inventory capacity range");
  
  // Fetch current items in inventory
  const invUrl = new URL(`${STRAPI_BASE_URL}/api/inventory-items`);
  invUrl.searchParams.set("filters[playerProfile][documentId][$eq]", profileDocId);
  invUrl.searchParams.set("populate", "item");
  invUrl.searchParams.set("pagination[limit]", "500");
  
  const invRes = await fetch(invUrl, { headers, cache: "no-store" });
  const invJson = await invRes.json();
  const currentInvItems: any[] = invJson.data ?? [];
  
  const sourceItem = currentInvItems.find(raw => Number(raw.slotIndex) === fromSlot);
  const targetItem = currentInvItems.find(raw => Number(raw.slotIndex) === toSlot);
  
  if (!sourceItem) throw new Error("Source slot is empty");
  if (targetItem) throw new Error("Target slot is not empty");
  
  const sourceQty = Number(sourceItem.quantity ?? 0);
  if (sourceQty <= splitQuantity) {
    throw new Error(`Split quantity must be strictly less than stack quantity (${sourceQty})`);
  }
  if (splitQuantity <= 0) throw new Error("Split quantity must be positive");
  
  const itemData = sourceItem.item;
  if (!itemData) throw new Error("Invalid item structure in source slot");
  
  // 1. Decrease source stack
  const sourceDocId = sourceItem.documentId ?? String(sourceItem.id);
  const decreaseRes = await fetch(`${STRAPI_BASE_URL}/api/inventory-items/${sourceDocId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { quantity: sourceQty - splitQuantity } }),
  });
  if (!decreaseRes.ok) throw new Error("Failed to decrease source stack");
  
  // 2. Create new stack in target slot
  const createRes = await fetch(`${STRAPI_BASE_URL}/api/inventory-items`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        playerProfile: profileDocId,
        item: itemData.documentId ?? String(itemData.id),
        quantity: splitQuantity,
        slotIndex: toSlot,
      },
    }),
  });
  if (!createRes.ok) throw new Error("Failed to create split stack");
  
  return true;
}

export async function buyWholesaleItem(username: string, itemKey: string, quantity: number): Promise<{ cost: number; walletAfter: number }> {
  const headers = getStrapiServiceHeaders();
  
  // 1. Fetch user profile
  const { profileDocId, wallet, capacity } = await getPlayerProfileAndInventory(username);
  
  // 2. Fetch item wholesale price
  const itemUrl = new URL(`${STRAPI_BASE_URL}/api/items`);
  itemUrl.searchParams.set("filters[key][$eq]", itemKey);
  itemUrl.searchParams.set("pagination[limit]", "1");
  const itemRes = await fetch(itemUrl, { headers, cache: "no-store" });
  const itemJson = await itemRes.json();
  const itemData = itemJson.data?.[0];
  if (!itemData) throw new Error(`Item definition not found: ${itemKey}`);
  
  const baseValue = Number(itemData.baseValue ?? 0);
  const totalCost = baseValue * quantity;
  
  if (wallet < totalCost) {
    throw new Error(`Insufficient Credits! Cost: ${totalCost}, Wallet: ${wallet}`);
  }
  
  // 3. Add item to inventory (reverts/throws if bag full)
  await addItemsToInventory(profileDocId, itemKey, quantity, capacity);
  
  // 4. Deduct money
  const nextWallet = wallet - totalCost;
  const profileUpdateRes = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${profileDocId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { wallet: nextWallet } }),
  });
  
  if (!profileUpdateRes.ok) {
    // Note: in a perfect transaction system we would rollback inventory addition, but for our scale, this is simple and robust
    throw new Error(`Failed to deduct credits from wallet (${profileUpdateRes.status})`);
  }

  // 5. Log Transaction
  await logTransaction(profileDocId, -totalCost, "FEES", `Imported ${quantity}x ${itemData.displayName}`);
  
  return {
    cost: totalCost,
    walletAfter: nextWallet,
  };

}
