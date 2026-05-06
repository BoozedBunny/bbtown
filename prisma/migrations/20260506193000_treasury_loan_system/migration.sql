-- AlterTable
ALTER TABLE "Character" ADD COLUMN "loanStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Character" ADD COLUMN "loanLockedUntil" DATETIME;

-- CreateTable
CREATE TABLE "TreasuryLedgerEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "townId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreasuryLedgerEntry_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "TreasuryDaySnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "townId" INTEGER NOT NULL,
  "dateKey" TEXT NOT NULL,
  "openingBalance" INTEGER NOT NULL,
  "variationAmount" INTEGER NOT NULL,
  "loanNetAmount" INTEGER NOT NULL DEFAULT 0,
  "otherNetAmount" INTEGER NOT NULL DEFAULT 0,
  "closingBalance" INTEGER NOT NULL,
  "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreasuryDaySnapshot_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CharacterLoan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "townId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "principalOrigin" INTEGER NOT NULL,
  "remainingPrincipal" INTEGER NOT NULL,
  "aprBps" INTEGER NOT NULL,
  "dailyInterestBps" INTEGER NOT NULL,
  "lateFeesAccrued" INTEGER NOT NULL DEFAULT 0,
  "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" DATETIME NOT NULL,
  "lastInterestAccrualDateKey" TEXT NOT NULL,
  "missedPaymentDays" INTEGER NOT NULL DEFAULT 0,
  "nextDueDateKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CharacterLoan_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CharacterLoan_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "LoanRepayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "loanId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "amountPaid" INTEGER NOT NULL,
  "appliedFees" INTEGER NOT NULL,
  "appliedInterest" INTEGER NOT NULL,
  "appliedPrincipal" INTEGER NOT NULL,
  "paymentSource" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "CharacterLoan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoanRepayment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "LoanOperation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "responseJson" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "loanId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanOperation_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoanOperation_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "CharacterLoan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "TreasuryLedgerEntry_townId_createdAt_idx" ON "TreasuryLedgerEntry"("townId", "createdAt");
CREATE INDEX "TreasuryLedgerEntry_referenceType_referenceId_idx" ON "TreasuryLedgerEntry"("referenceType", "referenceId");
CREATE UNIQUE INDEX "TreasuryDaySnapshot_townId_dateKey_key" ON "TreasuryDaySnapshot"("townId", "dateKey");
CREATE INDEX "CharacterLoan_characterId_status_idx" ON "CharacterLoan"("characterId", "status");
CREATE UNIQUE INDEX "LoanOperation_idempotencyKey_key" ON "LoanOperation"("idempotencyKey");
CREATE UNIQUE INDEX "CharacterLoan_one_active_per_character" ON "CharacterLoan"("characterId") WHERE "status" IN ('ACTIVE','DELINQUENT');

-- bootstrap ledger entries
INSERT INTO "TreasuryLedgerEntry" ("id", "townId", "kind", "amount", "referenceType", "referenceId", "metadataJson", "createdAt")
SELECT lower(hex(randomblob(16))), t."id", 'ADMIN_ADJUSTMENT', t."bankBalance", 'bootstrap_migration', t."id", '{"source":"bootstrap_migration"}', CURRENT_TIMESTAMP
FROM "Town" t;

INSERT INTO "TreasuryDaySnapshot" ("id", "townId", "dateKey", "openingBalance", "variationAmount", "loanNetAmount", "otherNetAmount", "closingBalance", "processedAt")
SELECT lower(hex(randomblob(16))), t."id", strftime('%Y-%m-%d','now'), t."bankBalance", 0, 0, 0, t."bankBalance", CURRENT_TIMESTAMP
FROM "Town" t;
