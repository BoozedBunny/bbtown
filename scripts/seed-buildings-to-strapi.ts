import { HARDCODED_BUILDINGS } from "../apps/web/app/town/[townId]/town-config";

type StrapiEntity = { id: number; documentId?: string; buildingId?: string };

const baseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1338";
const token = process.env.STRAPI_API_TOKEN;

if (!token) {
  console.error("Missing STRAPI_API_TOKEN env var.");
  process.exit(1);
}

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

async function fetchOneBuildingByBuildingId(buildingId: string): Promise<StrapiEntity | null> {
  const url = new URL(`${baseUrl}/api/buildings`);
  url.searchParams.set("filters[buildingId][$eq]", buildingId);
  url.searchParams.set("pagination[limit]", "1");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query buildings (${res.status})`);
  const json = (await res.json()) as { data?: StrapiEntity[] };
  return json.data?.[0] ?? null;
}

function toData(input: (typeof HARDCODED_BUILDINGS)[number]) {
  const [x, y, z] = input.position;
  const scaleValue = typeof input.scale === "number" ? input.scale : undefined;

  return {
    buildingId: input.id,
    name: input.name,
    type: input.type,
    image: input.image,
    color: input.color ?? "#BD00FF",
    positionX: x,
    positionY: y,
    positionZ: z,
    rotationX: input.rotationX ?? 0,
    rotationY: input.rotationY ?? 0,
    rotationZ: input.rotationZ ?? 0,
    scale: scaleValue,
    iconPosition: input.iconPosition,
    spriteConfig: input.spriteConfig ?? null,
  };
}

async function createBuilding(data: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/api/buildings`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create building failed (${res.status}): ${text}`);
  }
}

async function updateBuilding(identifier: string, data: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/api/buildings/${identifier}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update building failed (${res.status}): ${text}`);
  }
}

async function main() {
  let created = 0;
  let updated = 0;

  for (const building of HARDCODED_BUILDINGS) {
    if (!building.id || !building.name || !building.position) continue;

    const data = toData(building);
    const existing = await fetchOneBuildingByBuildingId(building.id);

    if (!existing) {
      await createBuilding(data);
      created += 1;
      console.log(`created building ${building.id} (${building.name})`);
      continue;
    }

    const identifier = existing.documentId ?? String(existing.id);
    await updateBuilding(identifier, data);
    updated += 1;
    console.log(`updated building ${building.id} (${building.name})`);
  }

  console.log(`done: created=${created} updated=${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
