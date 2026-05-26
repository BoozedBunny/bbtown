import crypto from "crypto";
import { treasuryConfig } from "@/lib/treasury/config";
import { addUtcDays, toUtcDateKey } from "@/lib/treasury/utils";
import { updatePlayerProfileByAuthUserId } from "@/lib/strapiAuth";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

type LoanRecord = {
  id: string;
  profileId: string;
  authUserId: number;
  status: "ACTIVE" | "DELINQUENT" | "PAID" | "DEFAULTED";
  principalOrigin: number;
  remainingPrincipal: number;
  aprBps: number;
  dailyInterestBps: number;
  dueAt: string;
  nextDueDateKey: string;
  lastInterestAccrualDateKey: string;
  lateFeesAccrued: number;
  missedPaymentDays: number;
  issuedAt: string;
  updatedAt: string;
  repayments: Array<{
    amountPaid: number;
    appliedFees: number;
    appliedInterest: number;
    appliedPrincipal: number;
    createdAt: string;
    paymentSource: "MANUAL";
  }>;
};

const loanBook = new Map<string, LoanRecord>();
const loanOps = new Map<string, any>();

function requireStrapiToken() {
  if (!STRAPI_TOKEN) throw new Error("Missing STRAPI_API_TOKEN");
  return STRAPI_TOKEN;
}

async function fetchProfileById(profileId: string) {
  const token = requireStrapiToken();
  const res = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${encodeURIComponent(profileId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Profile fetch failed: ${res.status} ${txt}`);
  }
  const payload = (await res.json()) as { data?: any };
  const p = payload.data;
  if (!p) throw new Error("Profile not found");
  return {
    id: p.documentId ?? String(p.id),
    authUserId: Number(p.authUserId),
    wallet: Number(p.wallet ?? 0),
    loanStatus: (p.loanStatus ?? "NONE") as "NONE" | "ACTIVE" | "DELINQUENT",
    loanLockedUntil: p.loanLockedUntil ? new Date(p.loanLockedUntil) : null,
  };
}

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

export async function getLoanState(characterId: string) {
  return loanBook.get(characterId) ?? null;
}

export async function createLoanQuote(characterId: string, requestedPrincipal: number) {
  const profile = await fetchProfileById(characterId);
  const active = loanBook.get(characterId);
  if (active && ["ACTIVE", "DELINQUENT"].includes(active.status)) {
    return { eligible: false, reasonCode: LoanReasonCode.HAS_ACTIVE_LOAN };
  }
  if (profile.loanLockedUntil && profile.loanLockedUntil > new Date()) {
    return { eligible: false, reasonCode: LoanReasonCode.COOLDOWN_ACTIVE };
  }

  const maxByWallet = Math.floor(profile.wallet * treasuryConfig.loanMaxLtvOfWallet);
  const principal = Math.max(treasuryConfig.loanMinPrincipal, Math.min(requestedPrincipal, maxByWallet, treasuryConfig.loanHardCap));
  const now = new Date();
  const due = addUtcDays(now, treasuryConfig.loanTermDays);
  const expiresAt = new Date(now.getTime() + treasuryConfig.quoteTtlMs);

  const quote = {
    principal,
    fee: Math.round((principal * treasuryConfig.loanOriginationFeeBps) / 10_000),
    netDisbursement: principal - Math.round((principal * treasuryConfig.loanOriginationFeeBps) / 10_000),
    aprBps: treasuryConfig.loanAprBps,
    dueDateKey: toUtcDateKey(due),
    expiresAt: expiresAt.toISOString(),
    characterId,
    townId: 1,
  };
  return { eligible: true, quote: { ...quote, hash: quoteHash(JSON.stringify(quote)) } };
}

export async function issueLoan(characterId: string, quote: any, quoteHashValue: string, idempotencyKey: string) {
  if (!treasuryConfig.ffLoansIssue) throw new Error("Loan issue disabled");
  const existing = loanOps.get(idempotencyKey);
  if (existing) return existing;

  const { hash: _ignoredHash, ...quoteWithoutHash } = quote;
  const expectedHash = quoteHash(JSON.stringify(quoteWithoutHash));
  if (expectedHash !== quoteHashValue || new Date(quote.expiresAt) < new Date()) {
    return { error: LoanReasonCode.QUOTE_EXPIRED };
  }

  const profile = await fetchProfileById(characterId);
  const active = loanBook.get(characterId);
  if (active && ["ACTIVE", "DELINQUENT"].includes(active.status)) {
    return { error: LoanReasonCode.HAS_ACTIVE_LOAN };
  }

  const nextWallet = profile.wallet + Number(quote.netDisbursement ?? 0);
  await updatePlayerProfileByAuthUserId(profile.authUserId, { wallet: nextWallet, loanStatus: "ACTIVE", loanLockedUntil: null });

  const now = new Date();
  const loan: LoanRecord = {
    id: crypto.randomUUID(),
    profileId: characterId,
    authUserId: profile.authUserId,
    status: "ACTIVE",
    principalOrigin: quote.principal,
    remainingPrincipal: quote.principal,
    aprBps: quote.aprBps,
    dailyInterestBps: Math.floor(quote.aprBps / 365),
    dueAt: new Date(`${quote.dueDateKey}T00:00:00.000Z`).toISOString(),
    nextDueDateKey: quote.dueDateKey,
    lastInterestAccrualDateKey: toUtcDateKey(now),
    lateFeesAccrued: 0,
    missedPaymentDays: 0,
    issuedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    repayments: [],
  };
  loanBook.set(characterId, loan);

  const result = { loanId: loan.id, walletAfter: nextWallet, treasuryAfter: null };
  loanOps.set(idempotencyKey, result);
  return result;
}

export async function repayLoan(characterId: string, loanId: string, amount: number, idempotencyKey: string) {
  if (!treasuryConfig.ffLoansRepay) throw new Error("Loan repay disabled");
  if (amount < treasuryConfig.repayMinAmount) return { error: LoanReasonCode.AMOUNT_TOO_SMALL };

  const existing = loanOps.get(idempotencyKey);
  if (existing) return existing;

  const profile = await fetchProfileById(characterId);
  if (profile.wallet < amount) return { error: LoanReasonCode.INSUFFICIENT_FUNDS };

  const loan = loanBook.get(characterId);
  if (!loan || loan.id !== loanId || !["ACTIVE", "DELINQUENT"].includes(loan.status)) {
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

  loan.remainingPrincipal -= appliedPrincipal;
  loan.lateFeesAccrued -= appliedFees;
  loan.lastInterestAccrualDateKey = nowDateKey;
  loan.updatedAt = new Date().toISOString();

  const remainingPrincipal = loan.remainingPrincipal;
  const remainingFees = loan.lateFeesAccrued;
  const nextWallet = profile.wallet - amount;

  const loanClosed = remainingPrincipal <= 0 && remainingFees <= 0 && (interestDue - appliedInterest) <= 0;
  if (loanClosed) {
    loan.status = "PAID";
    const lockUntil = addUtcDays(new Date(), treasuryConfig.loanCooldownDaysAfterClose).toISOString();
    await updatePlayerProfileByAuthUserId(profile.authUserId, {
      wallet: nextWallet,
      loanStatus: "NONE",
      loanLockedUntil: lockUntil,
    });
  } else {
    await updatePlayerProfileByAuthUserId(profile.authUserId, {
      wallet: nextWallet,
      loanStatus: "ACTIVE",
    });
  }

  loan.repayments.unshift({
    amountPaid: amount,
    appliedFees,
    appliedInterest,
    appliedPrincipal,
    createdAt: new Date().toISOString(),
    paymentSource: "MANUAL",
  });
  loan.repayments = loan.repayments.slice(0, 10);

  const result = {
    applied: { fees: appliedFees, interest: appliedInterest, principal: appliedPrincipal },
    remaining: { principal: Math.max(0, remainingPrincipal), fees: Math.max(0, remainingFees) },
    walletAfter: nextWallet,
    treasuryAfter: null,
  };
  loanOps.set(idempotencyKey, result);
  return result;
}

export async function runLoanDelinquencySweep(now = new Date()) {
  if (!treasuryConfig.ffLoansDelinquency) return;

  for (const [profileId, loan] of loanBook.entries()) {
    if (!["ACTIVE", "DELINQUENT"].includes(loan.status)) continue;
    const today = toUtcDateKey(now);
    if (today <= loan.nextDueDateKey) continue;

    const dueDate = new Date(`${loan.nextDueDateKey}T00:00:00.000Z`);
    const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLate <= treasuryConfig.loanGraceDays) continue;

    const delinquentDays = daysLate - treasuryConfig.loanGraceDays;
    const shouldDefault = delinquentDays >= treasuryConfig.loanDefaultDays;
    loan.lateFeesAccrued = delinquentDays * treasuryConfig.loanLateFeeFlat;
    loan.missedPaymentDays = delinquentDays;
    loan.status = shouldDefault ? "DEFAULTED" : "DELINQUENT";

    await updatePlayerProfileByAuthUserId(loan.authUserId, {
      loanStatus: "DELINQUENT",
      loanLockedUntil: shouldDefault ? addUtcDays(now, treasuryConfig.loanDefaultLockDays).toISOString() : null,
    });

    loanBook.set(profileId, loan);
  }
}
