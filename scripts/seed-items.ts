import dotenv from "dotenv";
import path from "path";

// Load environment variables from apps/web/.env
dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });

type ItemSeed = {
  key: string;
  displayName: string;
  category: "CONSUMABLE" | "EQUIPMENT" | "MATERIAL" | "OTHER";
  baseValue: number;
  maxStackSize: number;
};

const ITEM_SEED: ItemSeed[] = [
  { key: "furniture", displayName: "Furniture", category: "MATERIAL", baseValue: 500, maxStackSize: 10 },
  { key: "alcohol", displayName: "Alcohol", category: "CONSUMABLE", baseValue: 50, maxStackSize: 99 },
  { key: "condoms", displayName: "Condoms", category: "CONSUMABLE", baseValue: 10, maxStackSize: 99 },
  { key: "lube", displayName: "Lube", category: "CONSUMABLE", baseValue: 15, maxStackSize: 99 },
  { key: "disinfectant", displayName: "Disinfectant", category: "CONSUMABLE", baseValue: 20, maxStackSize: 99 },
  { key: "soap", displayName: "Soap", category: "CONSUMABLE", baseValue: 5, maxStackSize: 99 },
  { key: "candles", displayName: "Candles", category: "CONSUMABLE", baseValue: 8, maxStackSize: 99 },
  { key: "lingerie", displayName: "Lingerie", category: "MATERIAL", baseValue: 150, maxStackSize: 20 },
  { key: "perfumes", displayName: "Perfumes", category: "CONSUMABLE", baseValue: 120, maxStackSize: 50 },
];

const baseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const token = process.env.STRAPI_API_TOKEN;

if (!token) {
  console.error("Missing STRAPI_API_TOKEN env var inside apps/web/.env.");
  process.exit(1);
}

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

async function fetchOneItemByKey(key: string): Promise<any | null> {
  const url = new URL(`${baseUrl}/api/items`);
  url.searchParams.set("filters[key][$eq]", key);
  url.searchParams.set("pagination[limit]", "1");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query items (${res.status})`);
  const json = (await res.json()) as { data?: any[] };
  return json.data?.[0] ?? null;
}

async function createItem(item: ItemSeed) {
  const res = await fetch(`${baseUrl}/api/items`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: item }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create item ${item.key} failed (${res.status}): ${text}`);
  }
}

async function updateItem(documentId: string, item: ItemSeed) {
  const res = await fetch(`${baseUrl}/api/items/${documentId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: item }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update item ${item.key} failed (${res.status}): ${text}`);
  }
}

async function main() {
  let created = 0;
  let updated = 0;

  for (const item of ITEM_SEED) {
    const existing = await fetchOneItemByKey(item.key);
    if (!existing) {
      await createItem(item);
      created += 1;
      console.log(`Created item: ${item.key} (${item.displayName})`);
      continue;
    }

    const documentId = existing.documentId ?? String(existing.id);
    await updateItem(documentId, item);
    updated += 1;
    console.log(`Updated item: ${item.key} (${item.displayName})`);
  }

  console.log(`Done: created=${created} updated=${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
