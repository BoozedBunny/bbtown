type Town = { id: number; documentId?: string; townId: number; name: string };
type Building = { id: number; documentId?: string; buildingId: string; name: string };
type BuildingState = { id: number; documentId?: string; stateId?: string };

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

const PRICE_BY_BUILDING_ID: Record<string, number> = {
  "8": 25000,
  "9": 26000,
  "10": 24000,
  "11": 24500,
  "12": 23000,
  "13": 27000,
  "14": 25500,
  "15": 25000,
  "16": 22000,
  "17": 24500,
  "18": 26500,
  "19": 29000,
  "20": 28000,
  "21": 50000,
  "22": 26000,
  "23": 25000,
  "24": 45000,
  "25": 42000,
  "26": 48000,
  "27": 24000,
};

async function fetchCollection<T>(path: string): Promise<T[]> {
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set("pagination[pageSize]", "200");
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Fetch ${path} failed (${res.status})`);
  const json = (await res.json()) as { data?: T[] };
  return json.data ?? [];
}

async function fetchStateByStateId(stateId: string): Promise<BuildingState | null> {
  const url = new URL(`${baseUrl}/api/building-states`);
  url.searchParams.set("filters[stateId][$eq]", stateId);
  url.searchParams.set("pagination[limit]", "1");
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Query building-state failed (${res.status})`);
  const json = (await res.json()) as { data?: BuildingState[] };
  return json.data?.[0] ?? null;
}

async function createState(data: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/api/building-states`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create building-state failed (${res.status}): ${text}`);
  }
}

async function updateState(identifier: string, data: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/api/building-states/${identifier}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update building-state failed (${res.status}): ${text}`);
  }
}

async function main() {
  const towns = await fetchCollection<Town>("/api/towns");
  const buildings = await fetchCollection<Building>("/api/buildings");

  if (!towns.length) throw new Error("No towns found. Run seed:towns:strapi first.");
  if (!buildings.length) throw new Error("No buildings found. Run seed:buildings:strapi first.");

  let created = 0;
  let updated = 0;

  for (const town of towns) {
    for (const building of buildings) {
      const stateId = `${town.townId}:${building.buildingId}`;
      const existing = await fetchStateByStateId(stateId);

      const data = {
        stateId,
        title: building.name,
        forSale: true,
        price: PRICE_BY_BUILDING_ID[building.buildingId] ?? 25000,
        employees: 0,
        town: town.documentId ?? String(town.id),
        building: building.documentId ?? String(building.id),
      };

      if (!existing) {
        await createState(data);
        created += 1;
      } else {
        const identifier = existing.documentId ?? String(existing.id);
        await updateState(identifier, data);
        updated += 1;
      }
    }
  }

  console.log(`done: created=${created} updated=${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
