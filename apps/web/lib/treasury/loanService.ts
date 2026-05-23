import crypto from "crypto";
import { LoanPaymentSource, LoanStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { treasuryConfig } from "@/lib/treasury/config";
import { addUtcDays, toUtcDateKey } from "@/lib/treasury/utils";
import { createLedgerEntry } from "@/lib/treasury/treasuryService";

export const LoanReasonCode = {
  HAS_ACTIVE_LOAN: "HAS_ACTIVE_LOAN",
  TREASURY_LIQUIDITY_LOW: "TREASURY_LIQUIDITY_LOW",
  COOLDOWN_ACTIVE: "COOLDOWN_ACTIVE",
  QUOTE_EXPIRED: "QUOTE_EXPIRED",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  LOAN_NOT_ACTIVE: "LOAN_NOT_ACTIVE",
  AMOUNT_TOO_SMALL: "AMOUNT_TOO_SMALL",
} as const;

export function quoteHash(payload: string) {
  return crypto.createHash("sha256").update(`${payload}:${treasuryConfig.quoteSalt}`).digest("hex");
}

async function getActiveLoan(characterId: string) {
  return prisma.characterLoan.findFirst({ where: { characterId, status: { in: ["ACTIVE", "DELINQUENT"] } } });
}

export async function getLoanState(characterId: string) {
  const loan = await prisma.characterLoan.findFirst({
    where: { characterId, status: { in: ["ACTIVE", "DELINQUENT"] } },
    orderBy: { issuedAt: "desc" },
    include: { repayments: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  return loan;
}

export async function createLoanQuote(characterId: string, requestedPrincipal: number) {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) throw new Error("Character not found");

  const activeLoan = await getActiveLoan(characterId);
  if (activeLoan) return { eligible: false, reasonCode: LoanReasonCode.HAS_ACTIVE_LOAN };
  if (character.loanLockedUntil && character.loanLockedUntil > new Date()) {
    return { eligible: false, reasonCode: LoanReasonCode.COOLDOWN_ACTIVE };
  }

  const maxByWallet = Math.floor(character.wallet * treasuryConfig.loanMaxLtvOfWallet);
  const principal = Math.max(treasuryConfig.loanMinPrincipal, Math.min(requestedPrincipal, maxByWallet, treasuryConfig.loanHardCap));
  const townId = 1;
  const town = await prisma.town.findUnique({ where: { id: townId } });
  if (!town || town.bankBalance - principal < treasuryConfig.treasuryReserveMin) {
    return { eligible: false, reasonCode: LoanReasonCode.TREASURY_LIQUIDITY_LOW };
  }

  const fee = Math.round((principal * treasuryConfig.loanOriginationFeeBps) / 10_000);
  const now = new Date();
  const due = addUtcDays(now, treasuryConfig.loanTermDays);
  const expiresAt = new Date(now.getTime() + treasuryConfig.quoteTtlMs);

  const quote = {
    principal,
    fee,
    netDisbursement: principal - fee,
    aprBps: treasuryConfig.loanAprBps,
    dueDateKey: toUtcDateKey(due),
    expiresAt: expiresAt.toISOString(),
    characterId,
    townId,
  };
  const hash = quoteHash(JSON.stringify(quote));

  return { eligible: true, quote: { ...quote, hash } };
}

export async function issueLoan(characterId: string, quote: any, quoteHashValue: string, idempotencyKey: string) {
  if (!treasuryConfig.ffLoansIssue) throw new Error("Loan issue disabled");
  const { hash: _ignoredHash, ...quoteWithoutHash } = quote;
  const expectedHash = quoteHash(JSON.stringify(quoteWithoutHash));
  if (expectedHash !== quoteHashValue || new Date(quote.expiresAt) < new Date()) {
    return { error: LoanReasonCode.QUOTE_EXPIRED };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.loanOperation.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return JSON.parse(existing.responseJson);
    }

    const character = await tx.character.findUnique({ where: { id: characterId } });
    if (!character) throw new Error("Character not found");
    const active = await tx.characterLoan.findFirst({ where: { characterId, status: { in: ["ACTIVE", "DELINQUENT"] } } });
    if (active) return { error: LoanReasonCode.HAS_ACTIVE_LOAN };

    const town = await tx.town.findUnique({ where: { id: quote.townId } });
    if (!town || town.bankBalance - quote.principal < treasuryConfig.treasuryReserveMin) {
      return { error: LoanReasonCode.TREASURY_LIQUIDITY_LOW };
    }

    const loan = await tx.characterLoan.create({
      data: {
        characterId,
        townId: quote.townId,
        status: "ACTIVE",
        principalOrigin: quote.principal,
        remainingPrincipal: quote.principal,
        aprBps: quote.aprBps,
        dailyInterestBps: Math.floor(quote.aprBps / 365),
        dueAt: new Date(`${quote.dueDateKey}T00:00:00.000Z`),
        nextDueDateKey: quote.dueDateKey,
        lastInterestAccrualDateKey: toUtcDateKey(new Date()),
      },
    });

    const nextWallet = character.wallet + quote.netDisbursement;
    const nextTown = town.bankBalance - quote.principal + quote.fee;

    await tx.character.update({ where: { id: characterId }, data: { wallet: nextWallet, loanStatus: "ACTIVE" } });
    await tx.town.update({ where: { id: quote.townId }, data: { bankBalance: nextTown } });

    await createLedgerEntry(tx, { townId: quote.townId, kind: "LOAN_PRINCIPAL_OUTFLOW", amount: -quote.principal, referenceType: "CharacterLoan", referenceId: loan.id });
    await createLedgerEntry(tx, { townId: quote.townId, kind: "LOAN_FEE_INFLOW", amount: quote.fee, referenceType: "CharacterLoan", referenceId: loan.id });

    const result = { loanId: loan.id, walletAfter: nextWallet, treasuryAfter: nextTown };
    await tx.loanOperation.create({ data: { idempotencyKey, operationType: "ISSUE", responseJson: JSON.stringify(result), characterId, loanId: loan.id } });
    return result;
  });
}

export async function repayLoan(characterId: string, loanId: string, amount: number, idempotencyKey: string) {
  if (!treasuryConfig.ffLoansRepay) throw new Error("Loan repay disabled");
  if (amount < treasuryConfig.repayMinAmount) return { error: LoanReasonCode.AMOUNT_TOO_SMALL };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.loanOperation.findUnique({ where: { idempotencyKey } });
    if (existing) return JSON.parse(existing.responseJson);

    const [character, loan] = await Promise.all([
      tx.character.findUnique({ where: { id: characterId } }),
      tx.characterLoan.findUnique({ where: { id: loanId } }),
    ]);
    if (!character || character.wallet < amount) return { error: LoanReasonCode.INSUFFICIENT_FUNDS };
    if (!loan || loan.characterId !== characterId || !["ACTIVE", "DELINQUENT"].includes(loan.status)) {
      return { error: LoanReasonCode.LOAN_NOT_ACTIVE };
    }

    const nowDateKey = toUtcDateKey(new Date());
    const interestDue = nowDateKey > loan.lastInterestAccrualDateKey
      ? Math.round((loan.remainingPrincipal * loan.dailyInterestBps) / 10_000)
      : 0;

    let remainingPayment = amount;
    let appliedFees = Math.min(loan.lateFeesAccrued, remainingPayment);
    remainingPayment -= appliedFees;

    const appliedInterest = Math.min(interestDue, remainingPayment);
    remainingPayment -= appliedInterest;

    const appliedPrincipal = Math.min(loan.remainingPrincipal, remainingPayment);

    const remainingPrincipal = loan.remainingPrincipal - appliedPrincipal;
    const remainingFees = loan.lateFeesAccrued - appliedFees;
    const nextWallet = character.wallet - amount;

    const town = await tx.town.update({ where: { id: loan.townId }, data: { bankBalance: { increment: amount } } });
    await tx.character.update({ where: { id: characterId }, data: { wallet: nextWallet } });

    const isClosed = remainingPrincipal === 0 && remainingFees === 0 && interestDue - appliedInterest === 0;
    await tx.characterLoan.update({
      where: { id: loan.id },
      data: {
        remainingPrincipal,
        lateFeesAccrued: remainingFees,
        status: isClosed ? "PAID" : loan.status,
        lastInterestAccrualDateKey: nowDateKey,
        version: { increment: 1 },
      },
    });

    if (isClosed) {
      await tx.character.update({
        where: { id: characterId },
        data: {
          loanStatus: "NONE",
          loanLockedUntil: addUtcDays(new Date(), treasuryConfig.loanCooldownDaysAfterClose),
        },
      });
    }

    if (appliedPrincipal > 0) await createLedgerEntry(tx, { townId: loan.townId, kind: "LOAN_REPAYMENT_PRINCIPAL_INFLOW", amount: appliedPrincipal, referenceType: "CharacterLoan", referenceId: loan.id });
    if (appliedInterest > 0) await createLedgerEntry(tx, { townId: loan.townId, kind: "LOAN_INTEREST_INFLOW", amount: appliedInterest, referenceType: "CharacterLoan", referenceId: loan.id });
    if (appliedFees > 0) await createLedgerEntry(tx, { townId: loan.townId, kind: "LOAN_FEE_INFLOW", amount: appliedFees, referenceType: "CharacterLoan", referenceId: loan.id });

    await tx.loanRepayment.create({
      data: { loanId: loan.id, characterId, amountPaid: amount, appliedFees, appliedInterest, appliedPrincipal, paymentSource: LoanPaymentSource.MANUAL },
    });

    const result = {
      applied: { fees: appliedFees, interest: appliedInterest, principal: appliedPrincipal },
      remaining: { principal: remainingPrincipal, fees: remainingFees },
      walletAfter: nextWallet,
      treasuryAfter: town.bankBalance,
    };
    await tx.loanOperation.create({ data: { idempotencyKey, operationType: "REPAY", responseJson: JSON.stringify(result), characterId, loanId } });
    return result;
  });
}

export async function runLoanDelinquencySweep(now = new Date()) {
  if (!treasuryConfig.ffLoansDelinquency) return;
  const loans = await prisma.characterLoan.findMany({ where: { status: { in: [LoanStatus.ACTIVE, LoanStatus.DELINQUENT] } } });
  const today = toUtcDateKey(now);

  const loanUpdatesByDelinquentDays = new Map<number, string[]>();
  const characterIdsToDefault = new Set<string>();
  const characterIdsToDelinquent = new Set<string>();

  for (const loan of loans) {
    if (today <= loan.nextDueDateKey) continue;
    const dueDate = new Date(`${loan.nextDueDateKey}T00:00:00.000Z`);
    const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLate <= treasuryConfig.loanGraceDays) continue;

    const delinquentDays = daysLate - treasuryConfig.loanGraceDays;
    const shouldDefault = delinquentDays >= treasuryConfig.loanDefaultDays;

    if (!loanUpdatesByDelinquentDays.has(delinquentDays)) {
      loanUpdatesByDelinquentDays.set(delinquentDays, []);
    }
    loanUpdatesByDelinquentDays.get(delinquentDays)!.push(loan.id);

    if (shouldDefault) {
      characterIdsToDefault.add(loan.characterId);
    } else {
      characterIdsToDelinquent.add(loan.characterId);
    }
  }

  // Execute CharacterLoan updates in batches grouped by delinquentDays
  for (const [delinquentDays, loanIds] of loanUpdatesByDelinquentDays.entries()) {
    const shouldDefault = delinquentDays >= treasuryConfig.loanDefaultDays;
    await prisma.characterLoan.updateMany({
      where: { id: { in: loanIds } },
      data: {
        status: shouldDefault ? LoanStatus.DEFAULTED : LoanStatus.DELINQUENT,
        lateFeesAccrued: delinquentDays * treasuryConfig.loanLateFeeFlat,
        missedPaymentDays: delinquentDays,
      },
    });
  }

  // Execute Character updates
  if (characterIdsToDefault.size > 0) {
    await prisma.character.updateMany({
      where: { id: { in: Array.from(characterIdsToDefault) } },
      data: {
        loanStatus: "DELINQUENT",
        loanLockedUntil: addUtcDays(now, treasuryConfig.loanDefaultLockDays),
      },
    });

    await prisma.buildingState.updateMany({
      where: { ownerId: { in: Array.from(characterIdsToDefault) } },
      data: {
        ownerId: null,
        forSale: true,
      },
    });
  }

  if (characterIdsToDelinquent.size > 0) {
    await prisma.character.updateMany({
      where: { id: { in: Array.from(characterIdsToDelinquent) } },
      data: {
        loanStatus: "DELINQUENT",
      },
    });
  }
}
