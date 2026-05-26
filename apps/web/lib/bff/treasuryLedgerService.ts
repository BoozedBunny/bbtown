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

function getHeaders(): HeadersInit {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error("Missing STRAPI_API_TOKEN");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function strapiList<T>(path: string, qs: Record<string, string>): Promise<T[]> {
  const url = new URL(`${STRAPI_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`${path} list failed: ${res.status} ${await res.text()}`);
  const payload = (await res.json()) as { data?: T[] };
  return payload.data ?? [];
}

async function strapiCreate(path: string, data: Record<string, unknown>) {
  const res = await fetch(`${STRAPI_BASE_URL}${path}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ data }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} create failed: ${res.status} ${await res.text()}`);
  const payload = (await res.json()) as { data?: { id: number; documentId?: string } };
  return payload.data;
}

async function getTownByTownId(townId: number) {
  const rows = await strapiList<Array<{ id: number; documentId?: string; townId?: number | string; bankBalance?: number }>[number]>("/api/towns", {
    "filters[townId][$eq]": String(townId),
    "pagination[limit]": "1",
  });
  return rows[0] ?? null;
}

async function listAllTowns() {
  return strapiList<Array<{ id: number; documentId?: string; townId?: number | string; bankBalance?: number }>[number]>("/api/towns", {
    "pagination[limit]": "500",
  });
}

async function updateTownBalance(townIdentifier: string, nextBalance: number) {
  const res = await fetch(`${STRAPI_BASE_URL}/api/towns/${encodeURIComponent(townIdentifier)}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ data: { bankBalance: nextBalance } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Town balance update failed: ${res.status} ${await res.text()}`);
}

export async function createLedgerEntry(_tx: unknown, input: {
  townId: number;
  kind: LedgerKind;
  amount: number;
  referenceType: string;
  referenceId: string;
  metadataJson?: string;
}) {
  const created = await strapiCreate("/api/treasury-ledger-entries", {
    townId: input.townId,
    kind: input.kind,
    amount: input.amount,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    metadataJson: input.metadataJson,
  });

  return {
    id: created?.documentId ?? String(created?.id ?? randomUUID()),
    townId: input.townId,
    kind: input.kind,
    amount: input.amount,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    metadataJson: input.metadataJson,
    createdAt: new Date().toISOString(),
  } satisfies LedgerEntry;
}

async function getSnapshot(townId: number, dateKey: string): Promise<DaySnapshot | null> {
  const rows = await strapiList<any>("/api/treasury-day-snapshots", {
    "filters[townId][$eq]": String(townId),
    "filters[dateKey][$eq]": dateKey,
    "pagination[limit]": "1",
  });
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.documentId ?? String(row.id),
    townId: Number(row.townId ?? townId),
    dateKey: row.dateKey,
    openingBalance: Number(row.openingBalance ?? 0),
    variationAmount: Number(row.variationAmount ?? 0),
    loanNetAmount: Number(row.loanNetAmount ?? 0),
    otherNetAmount: Number(row.otherNetAmount ?? 0),
    closingBalance: Number(row.closingBalance ?? 0),
  };
}

async function listSnapshotsByTown(townId: number, limit = 30): Promise<DaySnapshot[]> {
  const rows = await strapiList<any>("/api/treasury-day-snapshots", {
    "filters[townId][$eq]": String(townId),
    "sort[0]": "dateKey:asc",
    "pagination[limit]": String(limit),
  });
  return rows.map((row) => ({
    id: row.documentId ?? String(row.id),
    townId: Number(row.townId ?? townId),
    dateKey: row.dateKey,
    openingBalance: Number(row.openingBalance ?? 0),
    variationAmount: Number(row.variationAmount ?? 0),
    loanNetAmount: Number(row.loanNetAmount ?? 0),
    otherNetAmount: Number(row.otherNetAmount ?? 0),
    closingBalance: Number(row.closingBalance ?? 0),
  }));
}

export async function settleTreasuryDay(townId: number, dateKey: string) {
  const existing = await getSnapshot(townId, dateKey);
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
    referenceId: `${townId}:${dateKey}`,
    metadataJson: JSON.stringify({ pct, clampedByFloor }),
  });

  const created = await strapiCreate("/api/treasury-day-snapshots", {
    townId,
    dateKey,
    openingBalance,
    variationAmount,
    loanNetAmount: 0,
    otherNetAmount: 0,
    closingBalance,
  });

  return {
    id: created?.documentId ?? String(created?.id ?? randomUUID()),
    townId,
    dateKey,
    openingBalance,
    variationAmount,
    loanNetAmount: 0,
    otherNetAmount: 0,
    closingBalance,
  } satisfies DaySnapshot;
}

export async function runTreasuryDailySettlement(now = new Date()) {
  if (!treasuryConfig.ffDailyVariation) return;
  const towns = await listAllTowns();
  const todayKey = toUtcDateKey(now);

  for (const town of towns) {
    const normalizedTownId = Number(town.townId ?? town.id);
    if (!Number.isFinite(normalizedTownId)) continue;

    const existingForTown = await listSnapshotsByTown(normalizedTownId, 365);
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
  const todaySnapshot = await getSnapshot(townId, todayKey);
  const last7Days = (await listSnapshotsByTown(townId, 60)).slice(-7);

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
