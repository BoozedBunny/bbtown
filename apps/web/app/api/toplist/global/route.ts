import { NextRequest, NextResponse } from "next/server";
import {
  getGlobalToplist,
  PostMatchEntry,
  setGlobalToplist,
} from "@/lib/arena/toplist";
import { getSessionUser } from "@/lib/auth";

const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get("mode");
    if (mode !== "mp") {
      return NextResponse.json(
        { error: "Only mode=mp is supported" },
        { status: 400 },
      );
    }

    const parsedLimit = Number.parseInt(
      request.nextUrl.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`,
      10,
    );
    const limit = Number.isNaN(parsedLimit)
      ? DEFAULT_LIMIT
      : Math.max(1, Math.min(parsedLimit, 100));

    const snapshot = getGlobalToplist();
    return NextResponse.json({
      ranking_version: snapshot.rankingVersion,
      computed_at: snapshot.computedAt,
      entries: snapshot.entries.slice(0, limit),
    });
  } catch (error) {
    console.error("Failed to fetch global toplist", error);
    return NextResponse.json(
      { error: "Failed to fetch global toplist" },
      { status: 500 },
    );
  }
}

type ToplistWriteBody = {
  matchId: string;
  endedAt: number;
  entries: PostMatchEntry[];
};

const isValidEntry = (entry: PostMatchEntry): boolean => {
  return (
    typeof entry.playerId === "string" &&
    typeof entry.displayName === "string" &&
    Number.isInteger(entry.roundsReached) &&
    entry.roundsReached >= 0 &&
    (entry.eliminationOrder === null || Number.isInteger(entry.eliminationOrder)) &&
    (entry.eliminatedAtMs === null || Number.isInteger(entry.eliminatedAtMs))
  );
};

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ToplistWriteBody;
    if (!body || !Array.isArray(body.entries)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!body.entries.every(isValidEntry)) {
      return NextResponse.json({ error: "Invalid entry payload" }, { status: 400 });
    }

    const snapshot = setGlobalToplist(body.entries);
    return NextResponse.json({
      ranking_version: snapshot.rankingVersion,
      computed_at: snapshot.computedAt,
      entries: snapshot.entries,
    });
  } catch (error) {
    console.error("Failed to update global toplist", error);
    return NextResponse.json(
      { error: "Failed to update global toplist" },
      { status: 500 },
    );
  }
}
