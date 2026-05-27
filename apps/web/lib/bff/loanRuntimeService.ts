import crypto from "crypto";
import { treasuryConfig } from "@/lib/treasury/config";
import { addUtcDays, toUtcDateKey } from "@/lib/treasury/utils";
import { updatePlayerProfileByAuthUserId } from "@/lib/strapiAuth";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
function headers(): HeadersInit {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error("Missing STRAPI_API_TOKEN");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function strapiList<T>(path: string, qs: Record<string, string>): Promise<T[]> {
  const url = new URL(`${STRAPI_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`${path} list failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data?: T[] };
  return json.data ?? [];
}

async function strapiCreate<T>(path: string, data: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${STRAPI_BASE_URL}${path}`, {
    method: "POST",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`${path} create failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data?: T };
  if (!json.data) throw new Error(`${path} create returned empty`);
  return json.data;
}

async function strapiUpdate<T>(path: string, identifier: string, data: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${STRAPI_BASE_URL}${path}/${encodeURIComponent(identifier)}`, {
    method: "PUT",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`${path} update failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data?: T };
  if (!json.data) throw new Error(`${path} update returned empty`);
  return json.data;
}

type Profile = { id: number; documentId?: string; authUserId?: number; wallet?: number; loanStatus?: "NONE" | "ACTIVE" | "DELINQUENT"; loanLockedUntil?: string | null };
type LoanStateRow = {
  id: number;
  documentId?: string;
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
  updatedAt?: string;
  playerProfile?: { id?: number; documentId?: string; authUserId?: number };
};
type LoanRepaymentRow = {
  id: number;
  documentId?: string;
  amountPaid: number;
  appliedFees: number;
  appliedInterest: number;
  appliedPrincipal: number;
  paymentSource: "MANUAL";
  createdAt?: string;
};

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
  repayments: Array<{ amountPaid: number; appliedFees: number; appliedInterest: number; appliedPrincipal: number; createdAt: string; paymentSource: "MANUAL" }>;
};

async function fetchProfileById(profileId: string): Promise<{ id: number; identifier: string; authUserId: number; wallet: number; loanLockedUntil: Date | null }> {
  const direct = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${encodeURIComponent(profileId)}`, {
    headers: headers(),
    cache: "no-store",
  });

  if (direct.ok) {
    const payload = (await direct.json()) as { data?: Profile };
    const p = payload.data;
    if (!p) throw new Error("Profile not found");
    return {
      id: Number(p.id),
      identifier: p.documentId ?? String(p.id),
      authUserId: Number(p.authUserId),
      wallet: Number(p.wallet ?? 0),
      loanLockedUntil: p.loanLockedUntil ? new Date(p.loanLockedUntil) : null,
    };
  }

  const byDocumentId = await strapiList<Profile>("/api/player-profiles", {
    "filters[documentId][$eq]": profileId,
    "pagination[limit]": "1",
  });
  if (byDocumentId[0]) {
    const p = byDocumentId[0];
    return {
      id: Number(p.id),
      identifier: p.documentId ?? String(p.id),
      authUserId: Number(p.authUserId),
      wallet: Number(p.wallet ?? 0),
      loanLockedUntil: p.loanLockedUntil ? new Date(p.loanLockedUntil) : null,
    };
  }

  const numericId = Number(profileId);
  if (Number.isFinite(numericId) && numericId > 0) {
    const byNumericId = await strapiList<Profile>("/api/player-profiles", {
      "filters[id][$eq]": String(numericId),
      "pagination[limit]": "1",
    });
    const p = byNumericId[0];
    if (p) {
      return {
        id: Number(p.id),
        identifier: p.documentId ?? String(p.id),
        authUserId: Number(p.authUserId),
        wallet: Number(p.wallet ?? 0),
        loanLockedUntil: p.loanLockedUntil ? new Date(p.loanLockedUntil) : null,
      };
    }
  }

  throw new Error(`Profile fetch failed: ${direct.status} ${await direct.text()}`);
}

async function getActiveLoanRow(profileIdentifier: string): Promise<LoanStateRow | null> {
  const rows = await strapiList<LoanStateRow>("/api/loan-states", {
    "filters[playerProfile][documentId][$eq]": profileIdentifier,
    "filters[status][$in][0]": "ACTIVE",
    "filters[status][$in][1]": "DELINQUENT",
    "sort[0]": "createdAt:desc",
    "pagination[limit]": "1",
  });
  return rows[0] ?? null;
}

async function mapLoanRecord(profileIdentifier: string, row: LoanStateRow | null): Promise<LoanRecord | null> {
  if (!row) return null;
  const loanIdentifier = row.documentId ?? String(row.id);
  const repayments = await strapiList<LoanRepaymentRow>("/api/loan-repayments", {
    "filters[loanState][documentId][$eq]": loanIdentifier,
    "sort[0]": "createdAt:desc",
    "pagination[limit]": "10",
  });
  return {
    id: loanIdentifier,
    profileId: profileIdentifier,
    authUserId: Number(row.playerProfile?.authUserId ?? 0),
    status: row.status,
    principalOrigin: Number(row.principalOrigin ?? 0),
    remainingPrincipal: Number(row.remainingPrincipal ?? 0),
    aprBps: Number(row.aprBps ?? 0),
    dailyInterestBps: Number(row.dailyInterestBps ?? 0),
    dueAt: row.dueAt,
    nextDueDateKey: row.nextDueDateKey,
    lastInterestAccrualDateKey: row.lastInterestAccrualDateKey,
    lateFeesAccrued: Number(row.lateFeesAccrued ?? 0),
    missedPaymentDays: Number(row.missedPaymentDays ?? 0),
    issuedAt: row.issuedAt,
    updatedAt: row.updatedAt ?? row.issuedAt,
    repayments: repayments.map((r) => ({
      amountPaid: Number(r.amountPaid ?? 0),
      appliedFees: Number(r.appliedFees ?? 0),
      appliedInterest: Number(r.appliedInterest ?? 0),
      appliedPrincipal: Number(r.appliedPrincipal ?? 0),
      createdAt: r.createdAt ?? new Date().toISOString(),
      paymentSource: "MANUAL",
    })),
  };
}

async function getOp(idempotencyKey: string): Promise<any | null> {
  const rows = await strapiList<{ responseJson?: string }>("/api/loan-operations", {
    "filters[idempotencyKey][$eq]": idempotencyKey,
    "pagination[limit]": "1",
  });
  if (!rows[0]?.responseJson) return null;
  try { return JSON.parse(rows[0].responseJson); } catch { return null; }
}

async function putOp(idempotencyKey: string, profileIdentifier: string, operationType: "ISSUE" | "REPAY", payload: unknown) {
  await strapiCreate("/api/loan-operations", {
    idempotencyKey,
    profileIdentifier,
    operationType,
    responseJson: JSON.stringify(payload),
  });
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
  const profile = await fetchProfileById(characterId);
  const row = await getActiveLoanRow(profile.identifier);
  return mapLoanRecord(profile.identifier, row);
}

export async function createLoanQuote(characterId: string, requestedPrincipal: number) {
  const profile = await fetchProfileById(characterId);
  const active = await getActiveLoanRow(profile.identifier);
  if (active) return { eligible: false, reasonCode: LoanReasonCode.HAS_ACTIVE_LOAN };
  if (profile.loanLockedUntil && profile.loanLockedUntil > new Date()) return { eligible: false, reasonCode: LoanReasonCode.COOLDOWN_ACTIVE };

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
  const existing = await getOp(idempotencyKey);
  if (existing) return existing;

  const { hash: _ignoredHash, ...quoteWithoutHash } = quote;
  const expectedHash = quoteHash(JSON.stringify(quoteWithoutHash));
  if (expectedHash !== quoteHashValue || new Date(quote.expiresAt) < new Date()) return { error: LoanReasonCode.QUOTE_EXPIRED };

  const profile = await fetchProfileById(characterId);
  const active = await getActiveLoanRow(profile.identifier);
  if (active) return { error: LoanReasonCode.HAS_ACTIVE_LOAN };

  const nextWallet = profile.wallet + Number(quote.netDisbursement ?? 0);
  await updatePlayerProfileByAuthUserId(profile.authUserId, { wallet: nextWallet, loanStatus: "ACTIVE", loanLockedUntil: null });

  const now = new Date();
  const created = await strapiCreate<LoanStateRow>("/api/loan-states", {
    playerProfile: profile.id,
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
  });

  const result = { loanId: created.documentId ?? String(created.id), walletAfter: nextWallet, treasuryAfter: null };
  await putOp(idempotencyKey, profile.identifier, "ISSUE", result);
  return result;
}

export async function repayLoan(characterId: string, loanId: string, amount: number, idempotencyKey: string) {
  if (amount < treasuryConfig.repayMinAmount) return { error: LoanReasonCode.AMOUNT_TOO_SMALL };

  const existing = await getOp(idempotencyKey);
  if (existing) return existing;

  const profile = await fetchProfileById(characterId);
  if (profile.wallet < amount) return { error: LoanReasonCode.INSUFFICIENT_FUNDS };

  const active = await getActiveLoanRow(profile.identifier);
  if (!active) return { error: LoanReasonCode.LOAN_NOT_ACTIVE };
  const activeId = active.documentId ?? String(active.id);
  if (activeId !== loanId) return { error: LoanReasonCode.LOAN_NOT_ACTIVE };

  const nowDateKey = toUtcDateKey(new Date());
  const interestDue = nowDateKey > active.lastInterestAccrualDateKey ? Math.round((Number(active.remainingPrincipal ?? 0) * Number(active.dailyInterestBps ?? 0)) / 10_000) : 0;

  let remainingPayment = amount;
  const appliedFees = Math.min(Number(active.lateFeesAccrued ?? 0), remainingPayment);
  remainingPayment -= appliedFees;
  const appliedInterest = Math.min(interestDue, remainingPayment);
  remainingPayment -= appliedInterest;
  const appliedPrincipal = Math.min(Number(active.remainingPrincipal ?? 0), remainingPayment);

  const remainingPrincipal = Math.max(0, Number(active.remainingPrincipal ?? 0) - appliedPrincipal);
  const remainingFees = Math.max(0, Number(active.lateFeesAccrued ?? 0) - appliedFees);
  const nextWallet = profile.wallet - amount;
  const loanClosed = remainingPrincipal <= 0 && remainingFees <= 0 && (interestDue - appliedInterest) <= 0;

  await strapiUpdate("/api/loan-states", activeId, {
    remainingPrincipal,
    lateFeesAccrued: remainingFees,
    lastInterestAccrualDateKey: nowDateKey,
    status: loanClosed ? "PAID" : "ACTIVE",
  });

  await strapiCreate("/api/loan-repayments", {
    loanState: active.id,
    amountPaid: amount,
    appliedFees,
    appliedInterest,
    appliedPrincipal,
    paymentSource: "MANUAL",
  });

  if (loanClosed) {
    const lockUntil = addUtcDays(new Date(), treasuryConfig.loanCooldownDaysAfterClose).toISOString();
    await updatePlayerProfileByAuthUserId(profile.authUserId, { wallet: nextWallet, loanStatus: "NONE", loanLockedUntil: lockUntil });
  } else {
    await updatePlayerProfileByAuthUserId(profile.authUserId, { wallet: nextWallet, loanStatus: "ACTIVE" });
  }

  const result = {
    applied: { fees: appliedFees, interest: appliedInterest, principal: appliedPrincipal },
    remaining: { principal: remainingPrincipal, fees: remainingFees },
    walletAfter: nextWallet,
    treasuryAfter: null,
  };
  await putOp(idempotencyKey, profile.identifier, "REPAY", result);
  return result;
}

export async function runLoanDelinquencySweep(now = new Date()) {
  const rows = await strapiList<LoanStateRow>("/api/loan-states", {
    "filters[status][$in][0]": "ACTIVE",
    "filters[status][$in][1]": "DELINQUENT",
    "populate[playerProfile][fields][0]": "authUserId",
    "pagination[limit]": "500",
  });

  for (const loan of rows) {
    const today = toUtcDateKey(now);
    if (today <= loan.nextDueDateKey) continue;

    const dueDate = new Date(`${loan.nextDueDateKey}T00:00:00.000Z`);
    const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLate <= treasuryConfig.loanGraceDays) continue;

    const delinquentDays = daysLate - treasuryConfig.loanGraceDays;
    const shouldDefault = delinquentDays >= treasuryConfig.loanDefaultDays;
    const identifier = loan.documentId ?? String(loan.id);

    await strapiUpdate("/api/loan-states", identifier, {
      lateFeesAccrued: delinquentDays * treasuryConfig.loanLateFeeFlat,
      missedPaymentDays: delinquentDays,
      status: shouldDefault ? "DEFAULTED" : "DELINQUENT",
    });

    const authUserId = Number(loan.playerProfile?.authUserId ?? 0);
    if (authUserId > 0) {
      await updatePlayerProfileByAuthUserId(authUserId, {
        loanStatus: "DELINQUENT",
        loanLockedUntil: shouldDefault ? addUtcDays(now, treasuryConfig.loanDefaultLockDays).toISOString() : null,
      });
    }
  }
}
