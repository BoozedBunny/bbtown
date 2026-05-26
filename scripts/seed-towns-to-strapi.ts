type StrapiEntity = { id: number; documentId?: string; townId?: number; name?: string };

type TownSeed = { id: number; name: string };

const TOWN_SEED: TownSeed[] = [
  { id: 1, name: "HangoverHollow" },
  { id: 2, name: "TipsyToadstool" },
  { id: 3, name: "RumTumbleWeed" },
];

const baseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const token = process.env.STRAPI_API_TOKEN;

if (!token) {
  console.error("Missing STRAPI_API_TOKEN env var.");
  process.exit(1);
}

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

async function fetchOneTownByTownId(townId: number): Promise<StrapiEntity | null> {
  const url = new URL(`${baseUrl}/api/towns`);
  url.searchParams.set("filters[townId][$eq]", String(townId));
  url.searchParams.set("pagination[limit]", "1");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query towns (${res.status})`);
  const json = (await res.json()) as { data?: StrapiEntity[] };
  return json.data?.[0] ?? null;
}

async function createTown(townId: number, name: string) {
  const res = await fetch(`${baseUrl}/api/towns`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: { townId, name, bankBalance: 1000000 } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create town ${townId} failed (${res.status}): ${text}`);
  }
}

async function updateTown(identifier: string, townId: number, name: string) {
  const res = await fetch(`${baseUrl}/api/towns/${identifier}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { townId, name } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update town ${townId} failed (${res.status}): ${text}`);
  }
}

async function main() {
  let created = 0;
  let updated = 0;

  for (const town of TOWN_SEED) {
    const existing = await fetchOneTownByTownId(town.id);
    if (!existing) {
      await createTown(town.id, town.name);
      created += 1;
      console.log(`created town ${town.id} (${town.name})`);
      continue;
    }

    const identifier = existing.documentId ?? String(existing.id);
    await updateTown(identifier, town.id, town.name);
    updated += 1;
    console.log(`updated town ${town.id} (${town.name})`);
  }

  console.log(`done: created=${created} updated=${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
