import { randomUUID } from "node:crypto";
import { treasuryConfig } from "@/lib/treasury/config";
import { addUtcDays, clamp, seededPercent, toUtcDateKey, roundInt } from "@/lib/treasury/utils";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const DAY_MS = 24 * 60 * 60 * 1000;

type LedgerKind =
  | "DAILY_VARIATION"
  | "LOAN_PRINCIPAL_OUTFLOW"
  | "LOAN_FEE_INFLOW"
  | "LOAN_REPAYMENT_PRINCIPAL_INFLOW"
  | "LOAN_INTEREST_INFLOW"
  | "BUILDING_SALE_INFLOW";

type LedgerEntry = {
  id: string;
  townId: number;
  kind: LedgerKind;
  amount: number;
  referenceType: string;
  referenceId: string;
  metadataJson?: string;
  createdAt: string;
};

type DaySnapshot = {
  id: string;
  townId: number;
  dateKey: string;
  openingBalance: number;
  variationAmount: number;
  loanNetAmount: number;
  otherNetAmount: number;
  closingBalance: number;
};

const ledgerStore: LedgerEntry[] = [];
const daySnapshotStore = new Map<string, DaySnapshot>(); // key townId:dateKey

function getHeaders(): HeadersInit {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error("Missing STRAPI_API_TOKEN");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function getTownByTownId(townId: number) {
  const headers = getHeaders();
  const url = new URL(`${STRAPI_BASE_URL}/api/towns`);
  url.searchParams.set("filters[townId][$eq]", String(townId));
  url.searchParams.set("pagination[limit]", "1");
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Town fetch failed: ${res.status}`);
  const payload = (await res.json()) as { data?: Array<{ id: number; documentId?: string; townId?: number | string; bankBalance?: number }> };
  return payload.data?.[0] ?? null;
}

async function listAllTowns() {
  const headers = getHeaders();
  const url = new URL(`${STRAPI_BASE_URL}/api/towns`);
  url.searchParams.set("pagination[limit]", "500");
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Town list failed: ${res.status}`);
  const payload = (await res.json()) as { data?: Array<{ id: number; documentId?: string; townId?: number | string; bankBalance?: number }> };
  return payload.data ?? [];
}

async function updateTownBalance(townIdentifier: string, nextBalance: number) {
  const headers = getHeaders();
  const res = await fetch(`${STRAPI_BASE_URL}/api/towns/${encodeURIComponent(townIdentifier)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: { bankBalance: nextBalance } }),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Town balance update failed: ${res.status} ${txt}`);
  }
}

export async function createLedgerEntry(_tx: unknown, input: {
  townId: number;
  kind: LedgerKind;
  amount: number;
  referenceType: string;
  referenceId: string;
  metadataJson?: string;
}) {
  const entry: LedgerEntry = {
    id: randomUUID(),
    townId: input.townId,
    kind: input.kind,
    amount: input.amount,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    metadataJson: input.metadataJson,
    createdAt: new Date().toISOString(),
  };
  ledgerStore.push(entry);
  return entry;
}

export async function settleTreasuryDay(townId: number, dateKey: string) {
  const key = `${townId}:${dateKey}`;
  const existing = daySnapshotStore.get(key);
  if (existing) return existing;

  const town = await getTownByTownId(townId);
  if (!town) throw new Error("Town not found");

  const openingBalance = Number(town.bankBalance ?? 0);
  const seed = `${townId}:${dateKey}:${treasuryConfig.quoteSalt}`;
  const pct = seededPercent(seed, treasuryConfig.dailyVariationMinPct, treasuryConfig.dailyVariationMaxPct);
  const raw = roundInt(openingBalance * pct);
  let variationAmount = clamp(raw, treasuryConfig.dailyVariationFloorAbs, treasuryConfig.dailyVariationCapAbs);
  const unclampedClosing = openingBalance + variationAmount;
  let clampedByFloor = false;
  if (unclampedClosing < treasuryConfig.treasuryFloorBalance) {
    variationAmount = treasuryConfig.treasuryFloorBalance - openingBalance;
    clampedByFloor = true;
  }

  const closingBalance = openingBalance + variationAmount;
  const townIdentifier = town.documentId ?? String(town.id);
  await updateTownBalance(townIdentifier, closingBalance);

  await createLedgerEntry(null, {
    townId,
    kind: "DAILY_VARIATION",
    amount: variationAmount,
    referenceType: "TreasuryDaySnapshot",
    referenceId: key,
    metadataJson: JSON.stringify({ pct, clampedByFloor }),
  });

  const snapshot: DaySnapshot = {
    id: randomUUID(),
    townId,
    dateKey,
    openingBalance,
    variationAmount,
    loanNetAmount: 0,
    otherNetAmount: 0,
    closingBalance,
  };
  daySnapshotStore.set(key, snapshot);
  return snapshot;
}

export async function runTreasuryDailySettlement(now = new Date()) {
  if (!treasuryConfig.ffDailyVariation) return;
  const towns = await listAllTowns();
  const todayKey = toUtcDateKey(now);

  for (const town of towns) {
    const normalizedTownId = Number(town.townId ?? town.id);
    if (!Number.isFinite(normalizedTownId)) continue;

    const existingForTown = Array.from(daySnapshotStore.values())
      .filter((row) => row.townId === normalizedTownId)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    const last = existingForTown[existingForTown.length - 1];
    const startDate = last ? addUtcDays(new Date(`${last.dateKey}T00:00:00.000Z`), 1) : now;

    for (let d = startDate; toUtcDateKey(d) <= todayKey; d = new Date(d.getTime() + DAY_MS)) {
      await settleTreasuryDay(normalizedTownId, toUtcDateKey(d));
    }
  }
}

export async function getTreasurySummary(townId: number) {
  const town = await getTownByTownId(townId);
  const todayKey = toUtcDateKey(new Date());
  const todaySnapshot = daySnapshotStore.get(`${townId}:${todayKey}`) ?? null;
  const last7Days = Array.from(daySnapshotStore.values())
    .filter((row) => row.townId === townId)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-7);

  return {
    bankBalance: Number(town?.bankBalance ?? 0),
    todaySnapshot,
    last7Days,
    loanExposure: {
      activePrincipal: 0,
      delinquentPrincipal: 0,
      countActive: 0,
    },
  };
}
