import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserWithCharacter, isUnauthorizedError } from "@/lib/auth";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUserWithCharacter();
    const headers = {
      "Content-Type": "application/json",
      ...(STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {}),
    };

    const res = await fetch(`${STRAPI_BASE_URL}/api/player-profiles?pagination[limit]=100`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch player profiles");
    const json = await res.json();
    const profiles = json.data ?? [];

    // Filter out me
    const list = profiles
      .map((p: any) => ({
        username: p.username || p.displayName || "Unknown Player",
        documentId: p.documentId ?? String(p.id)
      }))
      .filter((p: any) => p.username !== user.username);

    return NextResponse.json(list);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/trade/players failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
