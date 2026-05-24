import { type PoolClient } from "pg";
import { many, oneOrNull, withTransaction } from "@/lib/db";
import { treasuryConfig } from "@/lib/treasury/config";
import { addUtcDays, clamp, seededPercent, toUtcDateKey, roundInt } from "@/lib/treasury/utils";

type TxClient = PoolClient | any;

type LedgerKind =
  | "DAILY_VARIATION"
  | "LOAN_PRINCIPAL_OUTFLOW"
  | "LOAN_FEE_INFLOW"
  | "LOAN_REPAYMENT_PRINCIPAL_INFLOW"
  | "LOAN_INTEREST_INFLOW"
  | "BUILDING_SALE_INFLOW";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createLedgerEntry(tx: TxClient, input: {
  townId: number;
  kind: LedgerKind;
  amount: number;
  referenceType: string;
  referenceId: string;
  metadataJson?: string;
}) {
  if (typeof tx?.query === "function") {
    return oneOrNull(
      'INSERT INTO "TreasuryLedgerEntry" ("townId", "kind", "amount", "referenceType", "referenceId", "metadataJson") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [input.townId, input.kind, input.amount, input.referenceType, input.referenceId, input.metadataJson ?? null],
      tx,
    );
  }

  if (tx?.treasuryLedgerEntry?.create) {
    return tx.treasuryLedgerEntry.create({ data: input });
  }

  throw new Error("Unsupported transaction client in createLedgerEntry");
}

export async function settleTreasuryDay(townId: number, dateKey: string) {
  return withTransaction(async (tx) => {
    const existing = await oneOrNull(
      'SELECT * FROM "TreasuryDaySnapshot" WHERE "townId" = $1 AND "dateKey" = $2 LIMIT 1',
      [townId, dateKey],
      tx,
    );
    if (existing) return existing;

    const town = await oneOrNull<{ bankBalance: number }>(
      'SELECT "bankBalance" FROM "Town" WHERE "id" = $1 LIMIT 1',
      [townId],
      tx,
    );
    if (!town) throw new Error("Town not found");

    const openingBalance = town.bankBalance;
    const seed = `${townId}:${dateKey}:${treasuryConfig.quoteSalt}`;
    const pct = seededPercent(seed, treasuryConfig.dailyVariationMinPct, treasuryConfig.dailyVariationMaxPct);
    const raw = roundInt(openingBalance * pct);
    let variationAmount = clamp(raw, treasuryConfig.dailyVariationFloorAbs, treasuryConfig.dailyVariationCapAbs);
    const unclampedClosing = openingBalance + variationAmount;
    let clamped = false;
    if (unclampedClosing < treasuryConfig.treasuryFloorBalance) {
      variationAmount = treasuryConfig.treasuryFloorBalance - openingBalance;
      clamped = true;
    }

    const closingBalance = openingBalance + variationAmount;

    await tx.query('UPDATE "Town" SET "bankBalance" = $2 WHERE "id" = $1', [townId, closingBalance]);

    await createLedgerEntry(tx, {
      townId,
      kind: "DAILY_VARIATION",
      amount: variationAmount,
      referenceType: "TreasuryDaySnapshot",
      referenceId: `${townId}:${dateKey}`,
      metadataJson: JSON.stringify({ pct, clamped }),
    });

    return oneOrNull(
      'INSERT INTO "TreasuryDaySnapshot" ("townId", "dateKey", "openingBalance", "variationAmount", "loanNetAmount", "otherNetAmount", "closingBalance") VALUES ($1, $2, $3, $4, 0, 0, $5) RETURNING *',
      [townId, dateKey, openingBalance, variationAmount, closingBalance],
      tx,
    );
  });
}

export async function runTreasuryDailySettlement(now = new Date()) {
  if (!treasuryConfig.ffDailyVariation) return;
  const towns = await many<{ id: number }>('SELECT "id" FROM "Town"');
  const todayKey = toUtcDateKey(now);

  for (const town of towns) {
    const last = await oneOrNull<{ dateKey: string }>(
      'SELECT "dateKey" FROM "TreasuryDaySnapshot" WHERE "townId" = $1 ORDER BY "dateKey" DESC LIMIT 1',
      [town.id],
    );

    const startDate = last ? addUtcDays(new Date(`${last.dateKey}T00:00:00.000Z`), 1) : now;
    for (let d = startDate; toUtcDateKey(d) <= todayKey; d = new Date(d.getTime() + DAY_MS)) {
      await settleTreasuryDay(town.id, toUtcDateKey(d));
    }
  }
}

export async function getTreasurySummary(townId: number) {
  const [town, today, last7, exposure] = await Promise.all([
    oneOrNull<{ bankBalance: number }>('SELECT "bankBalance" FROM "Town" WHERE "id" = $1 LIMIT 1', [townId]),
    oneOrNull('SELECT * FROM "TreasuryDaySnapshot" WHERE "townId" = $1 AND "dateKey" = $2 LIMIT 1', [townId, toUtcDateKey(new Date())]),
    many('SELECT * FROM "TreasuryDaySnapshot" WHERE "townId" = $1 ORDER BY "dateKey" DESC LIMIT 7', [townId]),
    oneOrNull<{ active_principal: number | null; count_active: number }>(
      'SELECT COALESCE(SUM("remainingPrincipal"), 0) AS active_principal, COUNT(*)::int AS count_active FROM "CharacterLoan" WHERE "townId" = $1 AND "status" IN (\'ACTIVE\', \'DELINQUENT\')',
      [townId],
    ),
  ]);

  return {
    bankBalance: town?.bankBalance ?? 0,
    todaySnapshot: today,
    last7Days: [...last7].reverse(),
    loanExposure: {
      activePrincipal: exposure?.active_principal ?? 0,
      delinquentPrincipal: 0,
      countActive: exposure?.count_active ?? 0,
    },
  };
}
