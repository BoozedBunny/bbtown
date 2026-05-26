import { NextResponse } from "next/server";

type StrapiTown = {
  id: number;
  documentId?: string;
  townId?: string | number;
  name?: string;
};

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";

function getHeaders(): HeadersInit {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function GET() {
  try {
    const url = new URL(`${STRAPI_BASE_URL}/api/towns`);
    url.searchParams.set("fields[0]", "townId");
    url.searchParams.set("fields[1]", "name");
    url.searchParams.set("sort", "townId:asc");
    url.searchParams.set("pagination[limit]", "500");

    const response = await fetch(url, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Strapi towns read failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as { data?: StrapiTown[] };

    const towns = (payload.data ?? [])
      .map((row) => ({
        id: String(row.townId ?? row.id),
        name: row.name ?? "",
      }))
      .filter((town) => town.id && town.name);

    return NextResponse.json({ towns });
  } catch (error) {
    console.error("GET /api/towns failed", error);
    return NextResponse.json({ error: "Failed to load towns from Strapi" }, { status: 502 });
  }
}
