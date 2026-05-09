import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma.ts";
import { createLoanQuote, issueLoan, repayLoan, runLoanDelinquencySweep, LoanReasonCode } from "../lib/treasury/loanService.ts";

test("loanService createLoanQuote", async (t) => {
  await t.test("returns error if character not found", async () => {
    const originalFindUnique = prisma.character.findUnique;
    prisma.character.findUnique = mock.fn(async () => null) as any;

    try {
      await assert.rejects(
        async () => {
          await createLoanQuote("nonexistent", 1000);
        },
        { message: "Character not found" }
      );
    } finally {
      prisma.character.findUnique = originalFindUnique;
    }
  });

  await t.test("returns error if character has active loan", async () => {
    const originalFindUniqueChar = prisma.character.findUnique;
    const originalFindFirstLoan = prisma.characterLoan.findFirst;

    prisma.character.findUnique = mock.fn(async () => ({ id: "char1", wallet: 1000 })) as any;
    prisma.characterLoan.findFirst = mock.fn(async () => ({ id: "loan1" })) as any;

    try {
      const result = await createLoanQuote("char1", 1000);
      assert.deepEqual(result, { eligible: false, reasonCode: LoanReasonCode.HAS_ACTIVE_LOAN });
    } finally {
      prisma.character.findUnique = originalFindUniqueChar;
      prisma.characterLoan.findFirst = originalFindFirstLoan;
    }
  });

  await t.test("returns error if cooldown active", async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const originalFindUniqueChar = prisma.character.findUnique;
    const originalFindFirstLoan = prisma.characterLoan.findFirst;

    prisma.character.findUnique = mock.fn(async () => ({
      id: "char1",
      wallet: 1000,
      loanLockedUntil: futureDate
    })) as any;
    prisma.characterLoan.findFirst = mock.fn(async () => null) as any;

    try {
      const result = await createLoanQuote("char1", 1000);
      assert.deepEqual(result, { eligible: false, reasonCode: LoanReasonCode.COOLDOWN_ACTIVE });
    } finally {
      prisma.character.findUnique = originalFindUniqueChar;
      prisma.characterLoan.findFirst = originalFindFirstLoan;
    }
  });

  await t.test("returns error if treasury liquidity low", async () => {
    const originalFindUniqueChar = prisma.character.findUnique;
    const originalFindFirstLoan = prisma.characterLoan.findFirst;
    const originalFindUniqueTown = prisma.town.findUnique;

    prisma.character.findUnique = mock.fn(async () => ({ id: "char1", wallet: 1000, loanLockedUntil: null })) as any;
    prisma.characterLoan.findFirst = mock.fn(async () => null) as any;
    prisma.town.findUnique = mock.fn(async () => ({ id: 1, bankBalance: 500 })) as any; // Below min reserve

    try {
      const result = await createLoanQuote("char1", 1000);
      assert.deepEqual(result, { eligible: false, reasonCode: LoanReasonCode.TREASURY_LIQUIDITY_LOW });
    } finally {
      prisma.character.findUnique = originalFindUniqueChar;
      prisma.characterLoan.findFirst = originalFindFirstLoan;
      prisma.town.findUnique = originalFindUniqueTown;
    }
  });

  await t.test("returns valid quote if conditions are met", async () => {
    const originalFindUniqueChar = prisma.character.findUnique;
    const originalFindFirstLoan = prisma.characterLoan.findFirst;
    const originalFindUniqueTown = prisma.town.findUnique;

    prisma.character.findUnique = mock.fn(async () => ({ id: "char1", wallet: 1000, loanLockedUntil: null })) as any;
    prisma.characterLoan.findFirst = mock.fn(async () => null) as any;
    prisma.town.findUnique = mock.fn(async () => ({ id: 1, bankBalance: 100000 })) as any; // Lots of reserve

    try {
      const result = await createLoanQuote("char1", 1000);
      assert.strictEqual(result.eligible, true);
      assert.ok(result.quote);
      assert.strictEqual(result.quote.principal, 1000); // Because maxByWallet = 1000 * 3 = 3000, hardCap = 25000, so 1000 is chosen.
    } finally {
      prisma.character.findUnique = originalFindUniqueChar;
      prisma.characterLoan.findFirst = originalFindFirstLoan;
      prisma.town.findUnique = originalFindUniqueTown;
    }
  });
});

test("loanService issueLoan", async (t) => {
  const { treasuryConfig } = await import("../lib/treasury/config.ts");

  await t.test("throws error if feature flag disabled", async () => {
    const origFfLoansIssue = treasuryConfig.ffLoansIssue;
    treasuryConfig.ffLoansIssue = false;

    try {
      await assert.rejects(
        async () => {
          await issueLoan("char1", {}, "hash", "idemp1");
        },
        { message: "Loan issue disabled" }
      );
    } finally {
      treasuryConfig.ffLoansIssue = origFfLoansIssue;
    }
  });
});

test("loanService issueLoan further tests", async (t) => {
  const { treasuryConfig } = await import("../lib/treasury/config.ts");
  const { quoteHash } = await import("../lib/treasury/loanService.ts");

  await t.test("returns error if invalid quote hash", async () => {
    const origFfLoansIssue = treasuryConfig.ffLoansIssue;
    treasuryConfig.ffLoansIssue = true;

    try {
      const quote = { expiresAt: new Date(Date.now() + 10000).toISOString() };
      const result = await issueLoan("char1", quote, "badhash", "idemp1");
      assert.deepEqual(result, { error: LoanReasonCode.QUOTE_EXPIRED });
    } finally {
      treasuryConfig.ffLoansIssue = origFfLoansIssue;
    }
  });

  await t.test("returns error if quote expired", async () => {
    const origFfLoansIssue = treasuryConfig.ffLoansIssue;
    treasuryConfig.ffLoansIssue = true;

    try {
      const quote = { expiresAt: new Date(Date.now() - 10000).toISOString() };
      const expectedHash = quoteHash(JSON.stringify(quote));
      const result = await issueLoan("char1", quote, expectedHash, "idemp1");
      assert.deepEqual(result, { error: LoanReasonCode.QUOTE_EXPIRED });
    } finally {
      treasuryConfig.ffLoansIssue = origFfLoansIssue;
    }
  });

  await t.test("returns existing operation if idempotency key found", async () => {
    const origFfLoansIssue = treasuryConfig.ffLoansIssue;
    treasuryConfig.ffLoansIssue = true;

    const originalTransaction = prisma.$transaction;
    prisma.$transaction = mock.fn(async (cb: any) => {
      const tx = {
        loanOperation: { findUnique: async () => ({ responseJson: JSON.stringify({ success: true, cached: true }) }) }
      };
      return cb(tx);
    }) as any;

    try {
      const quote = { expiresAt: new Date(Date.now() + 10000).toISOString() };
      const expectedHash = quoteHash(JSON.stringify(quote));
      const result = await issueLoan("char1", quote, expectedHash, "idemp1");
      assert.deepEqual(result, { success: true, cached: true });
    } finally {
      treasuryConfig.ffLoansIssue = origFfLoansIssue;
      prisma.$transaction = originalTransaction;
    }
  });

  await t.test("returns error if character has active loan inside tx", async () => {
    const origFfLoansIssue = treasuryConfig.ffLoansIssue;
    treasuryConfig.ffLoansIssue = true;

    const originalTransaction = prisma.$transaction;
    prisma.$transaction = mock.fn(async (cb: any) => {
      const tx = {
        loanOperation: { findUnique: async () => null },
        character: { findUnique: async () => ({ id: "char1" }) },
        characterLoan: { findFirst: async () => ({ id: "loan1" }) }
      };
      return cb(tx);
    }) as any;

    try {
      const quote = { expiresAt: new Date(Date.now() + 10000).toISOString() };
      const expectedHash = quoteHash(JSON.stringify(quote));
      const result = await issueLoan("char1", quote, expectedHash, "idemp1");
      assert.deepEqual(result, { error: LoanReasonCode.HAS_ACTIVE_LOAN });
    } finally {
      treasuryConfig.ffLoansIssue = origFfLoansIssue;
      prisma.$transaction = originalTransaction;
    }
  });

  await t.test("returns error if treasury low liquidity inside tx", async () => {
    const origFfLoansIssue = treasuryConfig.ffLoansIssue;
    treasuryConfig.ffLoansIssue = true;

    const originalTransaction = prisma.$transaction;
    prisma.$transaction = mock.fn(async (cb: any) => {
      const tx = {
        loanOperation: { findUnique: async () => null },
        character: { findUnique: async () => ({ id: "char1" }) },
        characterLoan: { findFirst: async () => null },
        town: { findUnique: async () => ({ id: 1, bankBalance: 500 }) } // Not enough
      };
      return cb(tx);
    }) as any;

    try {
      const quote = { principal: 1000, expiresAt: new Date(Date.now() + 10000).toISOString() };
      const expectedHash = quoteHash(JSON.stringify(quote));
      const result = await issueLoan("char1", quote, expectedHash, "idemp1");
      assert.deepEqual(result, { error: LoanReasonCode.TREASURY_LIQUIDITY_LOW });
    } finally {
      treasuryConfig.ffLoansIssue = origFfLoansIssue;
      prisma.$transaction = originalTransaction;
    }
  });

  await t.test("issues loan successfully", async () => {
    const origFfLoansIssue = treasuryConfig.ffLoansIssue;
    treasuryConfig.ffLoansIssue = true;

    const originalTransaction = prisma.$transaction;
    let ledgerEntriesCreated = 0;
    prisma.$transaction = mock.fn(async (cb: any) => {
      const tx = {
        loanOperation: {
          findUnique: async () => null,
          create: async () => ({})
        },
        character: {
          findUnique: async () => ({ id: "char1", wallet: 100 }),
          update: async () => ({})
        },
        characterLoan: {
          findFirst: async () => null,
          create: async () => ({ id: "new_loan_123" })
        },
        town: {
          findUnique: async () => ({ id: 1, bankBalance: 100000 }),
          update: async () => ({})
        },
        treasuryLedgerEntry: {
          create: async () => { ledgerEntriesCreated++; return {}; }
        }
      };
      return cb(tx);
    }) as any;

    try {
      const quote = {
        townId: 1,
        principal: 1000,
        netDisbursement: 900,
        fee: 100,
        aprBps: 1200,
        dueDateKey: "2024-01-01",
        expiresAt: new Date(Date.now() + 10000).toISOString()
      };
      const expectedHash = quoteHash(JSON.stringify(quote));
      const result = await issueLoan("char1", quote, expectedHash, "idemp1");

      assert.deepEqual(result, {
        loanId: "new_loan_123",
        walletAfter: 1000, // 100 + 900
        treasuryAfter: 99100, // 100000 - 1000 + 100
      });
      assert.strictEqual(ledgerEntriesCreated, 2);
    } finally {
      treasuryConfig.ffLoansIssue = origFfLoansIssue;
      prisma.$transaction = originalTransaction;
    }
  });
});

test("loanService repayLoan", async (t) => {
  const { treasuryConfig } = await import("../lib/treasury/config.ts");

  await t.test("throws error if feature flag disabled", async () => {
    const origFfLoansRepay = treasuryConfig.ffLoansRepay;
    treasuryConfig.ffLoansRepay = false;

    try {
      await assert.rejects(
        async () => {
          await repayLoan("char1", "loan1", 1000, "idemp1");
        },
        { message: "Loan repay disabled" }
      );
    } finally {
      treasuryConfig.ffLoansRepay = origFfLoansRepay;
    }
  });

  await t.test("returns error if amount too small", async () => {
    const origFfLoansRepay = treasuryConfig.ffLoansRepay;
    treasuryConfig.ffLoansRepay = true;

    try {
      const result = await repayLoan("char1", "loan1", 10, "idemp1"); // Less than repayMinAmount (100)
      assert.deepEqual(result, { error: LoanReasonCode.AMOUNT_TOO_SMALL });
    } finally {
      treasuryConfig.ffLoansRepay = origFfLoansRepay;
    }
  });

  await t.test("returns existing operation if idempotency key found", async () => {
    const origFfLoansRepay = treasuryConfig.ffLoansRepay;
    treasuryConfig.ffLoansRepay = true;

    const originalTransaction = prisma.$transaction;
    prisma.$transaction = mock.fn(async (cb: any) => {
      const tx = {
        loanOperation: { findUnique: async () => ({ responseJson: JSON.stringify({ success: true, cached: true }) }) }
      };
      return cb(tx);
    }) as any;

    try {
      const result = await repayLoan("char1", "loan1", 1000, "idemp1");
      assert.deepEqual(result, { success: true, cached: true });
    } finally {
      treasuryConfig.ffLoansRepay = origFfLoansRepay;
      prisma.$transaction = originalTransaction;
    }
  });

  await t.test("returns error if insufficient funds", async () => {
    const origFfLoansRepay = treasuryConfig.ffLoansRepay;
    treasuryConfig.ffLoansRepay = true;

    const originalTransaction = prisma.$transaction;
    prisma.$transaction = mock.fn(async (cb: any) => {
      const tx = {
        loanOperation: { findUnique: async () => null },
        character: { findUnique: async () => ({ id: "char1", wallet: 500 }) }, // Less than 1000
        characterLoan: { findUnique: async () => ({ id: "loan1" }) }
      };
      return cb(tx);
    }) as any;

    try {
      const result = await repayLoan("char1", "loan1", 1000, "idemp1");
      assert.deepEqual(result, { error: LoanReasonCode.INSUFFICIENT_FUNDS });
    } finally {
      treasuryConfig.ffLoansRepay = origFfLoansRepay;
      prisma.$transaction = originalTransaction;
    }
  });

  await t.test("returns error if loan not active", async () => {
    const origFfLoansRepay = treasuryConfig.ffLoansRepay;
    treasuryConfig.ffLoansRepay = true;

    const originalTransaction = prisma.$transaction;
    prisma.$transaction = mock.fn(async (cb: any) => {
      const tx = {
        loanOperation: { findUnique: async () => null },
        character: { findUnique: async () => ({ id: "char1", wallet: 5000 }) },
        characterLoan: { findUnique: async () => ({ id: "loan1", characterId: "char1", status: "PAID" }) }
      };
      return cb(tx);
    }) as any;

    try {
      const result = await repayLoan("char1", "loan1", 1000, "idemp1");
      assert.deepEqual(result, { error: LoanReasonCode.LOAN_NOT_ACTIVE });
    } finally {
      treasuryConfig.ffLoansRepay = origFfLoansRepay;
      prisma.$transaction = originalTransaction;
    }
  });

  await t.test("repays loan successfully - partial payment", async () => {
    const origFfLoansRepay = treasuryConfig.ffLoansRepay;
    treasuryConfig.ffLoansRepay = true;

    const originalTransaction = prisma.$transaction;
    let ledgerEntriesCreated = 0;
    prisma.$transaction = mock.fn(async (cb: any) => {
      const tx = {
        loanOperation: {
          findUnique: async () => null,
          create: async () => ({})
        },
        character: {
          findUnique: async () => ({ id: "char1", wallet: 5000 }),
          update: async () => ({})
        },
        characterLoan: {
          findUnique: async () => ({
            id: "loan1",
            characterId: "char1",
            townId: 1,
            status: "ACTIVE",
            remainingPrincipal: 2000,
            lateFeesAccrued: 100,
            dailyInterestBps: 10,
            lastInterestAccrualDateKey: "2000-01-01" // Past date to accrue interest
          }),
          update: async () => ({})
        },
        town: {
          update: async () => ({ bankBalance: 101000 })
        },
        treasuryLedgerEntry: {
          create: async () => { ledgerEntriesCreated++; return {}; }
        },
        loanRepayment: {
          create: async () => ({})
        }
      };
      return cb(tx);
    }) as any;

    try {
      // Repay amount 1000.
      // Applied: 100 to fees, 2 to interest ((2000 * 10) / 10000 = 2), 898 to principal.
      // Remaining principal: 2000 - 898 = 1102.
      const result = await repayLoan("char1", "loan1", 1000, "idemp1");

      assert.deepEqual(result.applied, { fees: 100, interest: 2, principal: 898 });
      assert.deepEqual(result.remaining, { principal: 1102, fees: 0 });
      assert.strictEqual(result.walletAfter, 4000); // 5000 - 1000
      assert.strictEqual(result.treasuryAfter, 101000);
      assert.strictEqual(ledgerEntriesCreated, 3); // Principal, Interest, Fees
    } finally {
      treasuryConfig.ffLoansRepay = origFfLoansRepay;
      prisma.$transaction = originalTransaction;
    }
  });
});

test("loanService runLoanDelinquencySweep", async (t) => {
  const { treasuryConfig } = await import("../lib/treasury/config.ts");
  const { toUtcDateKey, addUtcDays } = await import("../lib/treasury/utils.ts");

  await t.test("does nothing if feature flag disabled", async () => {
    const origFfLoansDelinquency = treasuryConfig.ffLoansDelinquency;
    treasuryConfig.ffLoansDelinquency = false;

    const originalFindMany = prisma.characterLoan.findMany;
    let findManyCalled = false;
    prisma.characterLoan.findMany = mock.fn(async () => {
      findManyCalled = true;
      return [];
    }) as any;

    try {
      await runLoanDelinquencySweep();
      assert.strictEqual(findManyCalled, false);
    } finally {
      treasuryConfig.ffLoansDelinquency = origFfLoansDelinquency;
      prisma.characterLoan.findMany = originalFindMany;
    }
  });

  await t.test("updates delinquent and defaulted loans", async () => {
    const origFfLoansDelinquency = treasuryConfig.ffLoansDelinquency;
    treasuryConfig.ffLoansDelinquency = true;

    const now = new Date("2024-01-10T12:00:00Z");

    const originalFindMany = prisma.characterLoan.findMany;
    const originalUpdateManyLoan = prisma.characterLoan.updateMany;
    const originalUpdateManyChar = prisma.character.updateMany;

    let loanUpdates: any[] = [];
    let charUpdates: any[] = [];

    // treasuryConfig.loanGraceDays = 1, loanDefaultDays = 5
    // Delinquent: daysLate = 2 -> delinquentDays = 1 -> shouldDefault = false
    // Defaulted: daysLate = 10 -> delinquentDays = 9 -> shouldDefault = true

    prisma.characterLoan.findMany = mock.fn(async () => [
      {
        id: "loan_delinquent",
        characterId: "char1",
        nextDueDateKey: "2024-01-08", // 2 days late
        status: "ACTIVE"
      },
      {
        id: "loan_defaulted",
        characterId: "char2",
        nextDueDateKey: "2023-12-31", // 10 days late
        status: "ACTIVE"
      },
      {
        id: "loan_grace",
        characterId: "char3",
        nextDueDateKey: "2024-01-09", // 1 day late (in grace period)
        status: "ACTIVE"
      },
      {
        id: "loan_future",
        characterId: "char4",
        nextDueDateKey: "2024-01-11", // Not late
        status: "ACTIVE"
      }
    ]) as any;

    prisma.characterLoan.updateMany = mock.fn(async (args: any) => {
      loanUpdates.push(args);
      return { count: 1 };
    }) as any;

    prisma.character.updateMany = mock.fn(async (args: any) => {
      charUpdates.push(args);
      return { count: 1 };
    }) as any;

    try {
      await runLoanDelinquencySweep(now);

      // loan updates grouped by delinquentDays
      // loan_delinquent: daysLate = 2, delinquentDays = 1
      // loan_defaulted: daysLate = 10, delinquentDays = 9
      assert.strictEqual(loanUpdates.length, 2);

      const delinquentUpdate = loanUpdates.find(u => u.where.id.in.includes("loan_delinquent"));
      assert.ok(delinquentUpdate);
      assert.strictEqual(delinquentUpdate.data.status, "DELINQUENT");
      assert.strictEqual(delinquentUpdate.data.missedPaymentDays, 1);

      const defaultedUpdate = loanUpdates.find(u => u.where.id.in.includes("loan_defaulted"));
      assert.ok(defaultedUpdate);
      assert.strictEqual(defaultedUpdate.data.status, "DEFAULTED");
      assert.strictEqual(defaultedUpdate.data.missedPaymentDays, 9);

      // char updates grouped by status
      assert.strictEqual(charUpdates.length, 2);

      const charDelinquentUpdate = charUpdates.find(u => u.where.id.in.includes("char1"));
      assert.ok(charDelinquentUpdate);
      assert.strictEqual(charDelinquentUpdate.data.loanStatus, "DELINQUENT");
      assert.strictEqual(charDelinquentUpdate.data.loanLockedUntil, undefined); // Only defaulted gets locked

      const charDefaultedUpdate = charUpdates.find(u => u.where.id.in.includes("char2"));
      assert.ok(charDefaultedUpdate);
      assert.strictEqual(charDefaultedUpdate.data.loanStatus, "DELINQUENT");
      assert.ok(charDefaultedUpdate.data.loanLockedUntil);

    } finally {
      treasuryConfig.ffLoansDelinquency = origFfLoansDelinquency;
      prisma.characterLoan.findMany = originalFindMany;
      prisma.characterLoan.updateMany = originalUpdateManyLoan;
      prisma.character.updateMany = originalUpdateManyChar;
    }
  });
});
