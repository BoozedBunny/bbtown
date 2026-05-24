import { prisma } from "@/lib/prisma";
import { treasuryConfig } from "@/lib/treasury/config";
import { addUtcDays, clamp, seededPercent, toUtcDateKey, roundInt } from "@/lib/treasury/utils";

type TxClient = Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => Promise<any> ? T : never;

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
  return tx.treasuryLedgerEntry.create({ data: input });
}

export async function settleTreasuryDay(townId: number, dateKey: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.treasuryDaySnapshot.findUnique({ where: { townId_dateKey: { townId, dateKey } } });
    if (existing) return existing;

    const town = await tx.town.findUnique({ where: { id: townId } });
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

    const updatedTown = await tx.town.update({
      where: { id: townId },
      data: { bankBalance: closingBalance },
    });

    await createLedgerEntry(tx, {
      townId,
      kind: "DAILY_VARIATION",
      amount: variationAmount,
      referenceType: "TreasuryDaySnapshot",
      referenceId: `${townId}:${dateKey}`,
      metadataJson: JSON.stringify({ pct, clamped }),
    });

    return tx.treasuryDaySnapshot.create({
      data: {
        townId,
        dateKey,
        openingBalance,
        variationAmount,
        loanNetAmount: 0,
        otherNetAmount: 0,
        closingBalance: updatedTown.bankBalance,
      },
    });
  });
}

export async function runTreasuryDailySettlement(now = new Date()) {
  if (!treasuryConfig.ffDailyVariation) return;
  const towns = await prisma.town.findMany({ select: { id: true } });
  const todayKey = toUtcDateKey(now);

  for (const town of towns) {
    const last = await prisma.treasuryDaySnapshot.findFirst({
      where: { townId: town.id },
      orderBy: { dateKey: "desc" },
    });

    const startDate = last ? addUtcDays(new Date(`${last.dateKey}T00:00:00.000Z`), 1) : now;
    for (let d = startDate; toUtcDateKey(d) <= todayKey; d = new Date(d.getTime() + DAY_MS)) {
      await settleTreasuryDay(town.id, toUtcDateKey(d));
    }
  }
}

export async function getTreasurySummary(townId: number) {
  const [town, today, last7, exposure] = await Promise.all([
    prisma.town.findUnique({ where: { id: townId } }),
    prisma.treasuryDaySnapshot.findUnique({ where: { townId_dateKey: { townId, dateKey: toUtcDateKey(new Date()) } } }),
    prisma.treasuryDaySnapshot.findMany({ where: { townId }, orderBy: { dateKey: "desc" }, take: 7 }),
    prisma.characterLoan.aggregate({
      where: { townId, status: { in: ["ACTIVE", "DELINQUENT"] } },
      _sum: { remainingPrincipal: true },
      _count: { _all: true },
    }),
  ]);

  return {
    bankBalance: town?.bankBalance ?? 0,
    todaySnapshot: today,
    last7Days: [...last7].reverse(),
    loanExposure: {
      activePrincipal: exposure._sum.remainingPrincipal ?? 0,
      delinquentPrincipal: 0,
      countActive: exposure._count._all,
    },
  };
}
