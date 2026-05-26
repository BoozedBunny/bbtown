import { NextResponse } from "next/server";
import { strapiFetchList } from "@/lib/cms/strapi";

type StrapiTown = {
  id: number;
  documentId?: string;
  townId?: string | number;
  name?: string;
};

export async function GET() {
  try {
    const response = await strapiFetchList<StrapiTown>(
      "/api/towns?fields[0]=townId&fields[1]=name&sort=townId:asc&pagination[limit]=500",
    );

    const towns = (response.data ?? [])
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
