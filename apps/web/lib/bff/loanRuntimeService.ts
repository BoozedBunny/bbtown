import crypto from "crypto";
import { many, oneOrNull, withTransaction } from "@/lib/db";
import { treasuryConfig } from "@/lib/treasury/config";
import { addUtcDays, toUtcDateKey } from "@/lib/treasury/utils";
import { createLedgerEntry } from "@/lib/bff/treasuryLedgerService";
import { updatePlayerProfileByAuthUserId } from "@/lib/strapiAuth";

const LOAN_PAYMENT_SOURCE_MANUAL = "MANUAL" as const;
const LOAN_STATUS = {
  ACTIVE: "ACTIVE",
  DELINQUENT: "DELINQUENT",
  DEFAULTED: "DEFAULTED",
} as const;

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
  return oneOrNull(
    'SELECT * FROM "CharacterLoan" WHERE "characterId" = $1 AND "status" IN (\'ACTIVE\', \'DELINQUENT\') LIMIT 1',
    [characterId],
  );
}

export async function getLoanState(characterId: string) {
  const loan = await oneOrNull<any>(
    'SELECT * FROM "CharacterLoan" WHERE "characterId" = $1 AND "status" IN (\'ACTIVE\', \'DELINQUENT\') ORDER BY "issuedAt" DESC LIMIT 1',
    [characterId],
  );
  if (!loan) return null;

  const repayments = await many(
    'SELECT * FROM "LoanRepayment" WHERE "loanId" = $1 ORDER BY "createdAt" DESC LIMIT 10',
    [loan.id],
  );

  return { ...loan, repayments };
}

export async function createLoanQuote(characterId: string, requestedPrincipal: number) {
  const character = await oneOrNull<any>('SELECT * FROM "Character" WHERE "id" = $1 LIMIT 1', [characterId]);
  if (!character) throw new Error("Character not found");

  const activeLoan = await getActiveLoan(characterId);
  if (activeLoan) return { eligible: false, reasonCode: LoanReasonCode.HAS_ACTIVE_LOAN };
  if (character.loanLockedUntil && new Date(character.loanLockedUntil) > new Date()) {
    return { eligible: false, reasonCode: LoanReasonCode.COOLDOWN_ACTIVE };
  }

  const maxByWallet = Math.floor(character.wallet * treasuryConfig.loanMaxLtvOfWallet);
  const principal = Math.max(treasuryConfig.loanMinPrincipal, Math.min(requestedPrincipal, maxByWallet, treasuryConfig.loanHardCap));
  const townId = 1;
  const town = await oneOrNull<{ bankBalance: number }>('SELECT "bankBalance" FROM "Town" WHERE "id" = $1 LIMIT 1', [townId]);
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

  return withTransaction(async (tx) => {
    const existing = await oneOrNull<{ responseJson: string }>(
      'SELECT "responseJson" FROM "LoanOperation" WHERE "idempotencyKey" = $1 LIMIT 1',
      [idempotencyKey],
      tx,
    );
    if (existing) return JSON.parse(existing.responseJson);

    const character = await oneOrNull<any>('SELECT * FROM "Character" WHERE "id" = $1 LIMIT 1', [characterId], tx);
    if (!character) throw new Error("Character not found");
    const active = await oneOrNull(
      'SELECT "id" FROM "CharacterLoan" WHERE "characterId" = $1 AND "status" IN (\'ACTIVE\', \'DELINQUENT\') LIMIT 1',
      [characterId],
      tx,
    );
    if (active) return { error: LoanReasonCode.HAS_ACTIVE_LOAN };

    const town = await oneOrNull<{ bankBalance: number }>('SELECT "bankBalance" FROM "Town" WHERE "id" = $1 LIMIT 1', [quote.townId], tx);
    if (!town || town.bankBalance - quote.principal < treasuryConfig.treasuryReserveMin) {
      return { error: LoanReasonCode.TREASURY_LIQUIDITY_LOW };
    }

    const loan = await oneOrNull<{ id: string }>(
      'INSERT INTO "CharacterLoan" ("characterId", "townId", "status", "principalOrigin", "remainingPrincipal", "aprBps", "dailyInterestBps", "dueAt", "nextDueDateKey", "lastInterestAccrualDateKey") VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9) RETURNING "id"',
      [
        characterId,
        quote.townId,
        "ACTIVE",
        quote.principal,
        quote.aprBps,
        Math.floor(quote.aprBps / 365),
        new Date(`${quote.dueDateKey}T00:00:00.000Z`),
        quote.dueDateKey,
        toUtcDateKey(new Date()),
      ],
      tx,
    );
    if (!loan) throw new Error("Failed to create loan");

    const nextWallet = character.wallet + quote.netDisbursement;
    const nextTown = town.bankBalance - quote.principal + quote.fee;

    await tx.query('UPDATE "Character" SET "wallet" = $2, "loanStatus" = $3 WHERE "id" = $1', [characterId, nextWallet, "ACTIVE"]);
    await tx.query('UPDATE "Town" SET "bankBalance" = $2 WHERE "id" = $1', [quote.townId, nextTown]);

    await createLedgerEntry(tx as any, { townId: quote.townId, kind: "LOAN_PRINCIPAL_OUTFLOW", amount: -quote.principal, referenceType: "CharacterLoan", referenceId: loan.id });
    await createLedgerEntry(tx as any, { townId: quote.townId, kind: "LOAN_FEE_INFLOW", amount: quote.fee, referenceType: "CharacterLoan", referenceId: loan.id });

    const result = { loanId: loan.id, walletAfter: nextWallet, treasuryAfter: nextTown };
    await tx.query(
      'INSERT INTO "LoanOperation" ("idempotencyKey", "operationType", "responseJson", "characterId", "loanId") VALUES ($1, $2, $3, $4, $5)',
      [idempotencyKey, "ISSUE", JSON.stringify(result), characterId, loan.id],
    );
    return result;
  });
}

export async function repayLoan(characterId: string, loanId: string, amount: number, idempotencyKey: string) {
  if (!treasuryConfig.ffLoansRepay) throw new Error("Loan repay disabled");
  if (amount < treasuryConfig.repayMinAmount) return { error: LoanReasonCode.AMOUNT_TOO_SMALL };

  return withTransaction(async (tx) => {
    const existing = await oneOrNull<{ responseJson: string }>(
      'SELECT "responseJson" FROM "LoanOperation" WHERE "idempotencyKey" = $1 LIMIT 1',
      [idempotencyKey],
      tx,
    );
    if (existing) return JSON.parse(existing.responseJson);

    const [character, loan] = await Promise.all([
      oneOrNull<any>('SELECT * FROM "Character" WHERE "id" = $1 LIMIT 1', [characterId], tx),
      oneOrNull<any>('SELECT * FROM "CharacterLoan" WHERE "id" = $1 LIMIT 1', [loanId], tx),
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
    const appliedFees = Math.min(loan.lateFeesAccrued, remainingPayment);
    remainingPayment -= appliedFees;

    const appliedInterest = Math.min(interestDue, remainingPayment);
    remainingPayment -= appliedInterest;

    const appliedPrincipal = Math.min(loan.remainingPrincipal, remainingPayment);

    const remainingPrincipal = loan.remainingPrincipal - appliedPrincipal;
    const remainingFees = loan.lateFeesAccrued - appliedFees;
    const nextWallet = character.wallet - amount;

    const town = await oneOrNull<{ bankBalance: number }>(
      'UPDATE "Town" SET "bankBalance" = "bankBalance" + $2 WHERE "id" = $1 RETURNING "bankBalance"',
      [loan.townId, amount],
      tx,
    );
    await tx.query('UPDATE "Character" SET "wallet" = $2 WHERE "id" = $1', [characterId, nextWallet]);

    const isClosed = remainingPrincipal === 0 && remainingFees === 0 && interestDue - appliedInterest === 0;
    await tx.query(
      'UPDATE "CharacterLoan" SET "remainingPrincipal" = $2, "lateFeesAccrued" = $3, "status" = $4, "lastInterestAccrualDateKey" = $5, "version" = "version" + 1 WHERE "id" = $1',
      [loan.id, remainingPrincipal, remainingFees, isClosed ? "PAID" : loan.status, nowDateKey],
    );

    if (isClosed) {
      await tx.query(
        'UPDATE "Character" SET "loanStatus" = $2, "loanLockedUntil" = $3 WHERE "id" = $1',
        [characterId, "NONE", addUtcDays(new Date(), treasuryConfig.loanCooldownDaysAfterClose)],
      );
    }

    if (appliedPrincipal > 0) await createLedgerEntry(tx as any, { townId: loan.townId, kind: "LOAN_REPAYMENT_PRINCIPAL_INFLOW", amount: appliedPrincipal, referenceType: "CharacterLoan", referenceId: loan.id });
    if (appliedInterest > 0) await createLedgerEntry(tx as any, { townId: loan.townId, kind: "LOAN_INTEREST_INFLOW", amount: appliedInterest, referenceType: "CharacterLoan", referenceId: loan.id });
    if (appliedFees > 0) await createLedgerEntry(tx as any, { townId: loan.townId, kind: "LOAN_FEE_INFLOW", amount: appliedFees, referenceType: "CharacterLoan", referenceId: loan.id });

    await tx.query(
      'INSERT INTO "LoanRepayment" ("loanId", "characterId", "amountPaid", "appliedFees", "appliedInterest", "appliedPrincipal", "paymentSource") VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [loan.id, characterId, amount, appliedFees, appliedInterest, appliedPrincipal, LOAN_PAYMENT_SOURCE_MANUAL],
    );

    const result = {
      applied: { fees: appliedFees, interest: appliedInterest, principal: appliedPrincipal },
      remaining: { principal: remainingPrincipal, fees: remainingFees },
      walletAfter: nextWallet,
      treasuryAfter: town?.bankBalance ?? null,
    };
    await tx.query(
      'INSERT INTO "LoanOperation" ("idempotencyKey", "operationType", "responseJson", "characterId", "loanId") VALUES ($1, $2, $3, $4, $5)',
      [idempotencyKey, "REPAY", JSON.stringify(result), characterId, loanId],
    );
    return result;
  });
}

export async function runLoanDelinquencySweep(now = new Date()) {
  if (!treasuryConfig.ffLoansDelinquency) return;
  const loans = await many<any>('SELECT * FROM "CharacterLoan" WHERE "status" IN (\'ACTIVE\', \'DELINQUENT\')');
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

  for (const [delinquentDays, loanIds] of loanUpdatesByDelinquentDays.entries()) {
    const shouldDefault = delinquentDays >= treasuryConfig.loanDefaultDays;
    await withTransaction(async (tx) => {
      await tx.query(
        'UPDATE "CharacterLoan" SET "status" = $2, "lateFeesAccrued" = $3, "missedPaymentDays" = $4 WHERE "id" = ANY($1)',
        [loanIds, shouldDefault ? LOAN_STATUS.DEFAULTED : LOAN_STATUS.DELINQUENT, delinquentDays * treasuryConfig.loanLateFeeFlat, delinquentDays],
      );
    });
  }

  if (characterIdsToDefault.size > 0) {
    const ids = Array.from(characterIdsToDefault);
    await withTransaction(async (tx) => {
      await tx.query(
        'UPDATE "Character" SET "loanStatus" = $2, "loanLockedUntil" = $3 WHERE "id" = ANY($1)',
        [ids, "DELINQUENT", addUtcDays(now, treasuryConfig.loanDefaultLockDays)],
      );

      await tx.query(
        'UPDATE "BuildingState" SET "ownerId" = NULL, "forSale" = true WHERE "ownerId" = ANY($1)',
        [ids],
      );
    });
  }

  if (characterIdsToDelinquent.size > 0) {
    await withTransaction(async (tx) => {
      await tx.query('UPDATE "Character" SET "loanStatus" = $2 WHERE "id" = ANY($1)', [Array.from(characterIdsToDelinquent), "DELINQUENT"]);
    });
  }

  const affectedCharacterIds = Array.from(new Set([...characterIdsToDefault, ...characterIdsToDelinquent]));
  if (affectedCharacterIds.length > 0) {
    const affectedCharacters = await many<any>(
      'SELECT "userId", "loanStatus", "loanLockedUntil" FROM "Character" WHERE "id" = ANY($1)',
      [affectedCharacterIds],
    );

    for (const character of affectedCharacters) {
      try {
        await updatePlayerProfileByAuthUserId(character.userId, {
          loanStatus: character.loanStatus,
          loanLockedUntil: character.loanLockedUntil ? new Date(character.loanLockedUntil).toISOString() : null,
        });
      } catch (error) {
        console.error("Failed to sync delinquency status to Strapi profile", {
          authUserId: character.userId,
          error,
        });
      }
    }
  }
}
