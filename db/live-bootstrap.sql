-- bbtown live bootstrap (without Prisma)
-- Purpose: create missing legacy web tables/columns/indexes idempotently.
-- Safe to run multiple times.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core auth/user tables
CREATE TABLE IF NOT EXISTS "User" (
  "id" uuid PRIMARY KEY,
  "username" text NOT NULL UNIQUE,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Character" (
  "id" uuid PRIMARY KEY,
  "userId" uuid NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "appearanceColor" text NOT NULL DEFAULT '#BD00FF',
  "avatar" text NOT NULL DEFAULT 'bunny',
  "description" text NULL,
  "wallet" integer NOT NULL DEFAULT 1000,
  "arenaMaxRounds" integer NOT NULL DEFAULT 0,
  "experience" integer NOT NULL DEFAULT 0,
  "loanStatus" text NOT NULL DEFAULT 'NONE',
  "loanLockedUntil" timestamptz NULL,
  "lastSoloArenaAt" timestamptz NULL
);

-- Market tables
CREATE TABLE IF NOT EXISTS "Stock" (
  "id" uuid PRIMARY KEY,
  "symbol" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "price" double precision NOT NULL,
  "previousPrice" double precision NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "StockHistory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "stockId" uuid NOT NULL REFERENCES "Stock"("id") ON DELETE CASCADE,
  "price" double precision NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "PortfolioItem" (
  "id" uuid PRIMARY KEY,
  "characterId" uuid NOT NULL REFERENCES "Character"("id") ON DELETE CASCADE,
  "stockId" uuid NOT NULL REFERENCES "Stock"("id") ON DELETE CASCADE,
  "quantity" integer NOT NULL DEFAULT 0,
  CONSTRAINT "PortfolioItem_character_stock_unique" UNIQUE ("characterId", "stockId")
);

-- Town/building/treasury tables
CREATE TABLE IF NOT EXISTS "Town" (
  "id" integer PRIMARY KEY,
  "name" text NOT NULL,
  "bankBalance" integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "BuildingState" (
  "id" text PRIMARY KEY,
  "townId" text NOT NULL,
  "title" text NOT NULL,
  "forSale" boolean NOT NULL DEFAULT true,
  "price" integer NOT NULL DEFAULT 0,
  "employees" integer NOT NULL DEFAULT 0,
  "ownerId" uuid NULL REFERENCES "Character"("id") ON DELETE SET NULL,
  "buildingLevel" INTEGER DEFAULT 0,
  "upgradeEndsAt" TIMESTAMP WITH TIME ZONE NULL
);

CREATE TABLE IF NOT EXISTS "TreasuryLedgerEntry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "townId" integer NOT NULL REFERENCES "Town"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "amount" integer NOT NULL,
  "referenceType" text NOT NULL,
  "referenceId" text NOT NULL,
  "metadataJson" text NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TreasuryDaySnapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "townId" integer NOT NULL REFERENCES "Town"("id") ON DELETE CASCADE,
  "dateKey" text NOT NULL,
  "openingBalance" integer NOT NULL,
  "variationAmount" integer NOT NULL,
  "loanNetAmount" integer NOT NULL DEFAULT 0,
  "otherNetAmount" integer NOT NULL DEFAULT 0,
  "closingBalance" integer NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "TreasuryDaySnapshot_town_date_unique" UNIQUE ("townId", "dateKey")
);

-- Loan tables
CREATE TABLE IF NOT EXISTS "CharacterLoan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "characterId" uuid NOT NULL REFERENCES "Character"("id") ON DELETE CASCADE,
  "townId" integer NOT NULL REFERENCES "Town"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "principalOrigin" integer NOT NULL,
  "remainingPrincipal" integer NOT NULL,
  "aprBps" integer NOT NULL,
  "dailyInterestBps" integer NOT NULL,
  "dueAt" timestamptz NOT NULL,
  "nextDueDateKey" text NOT NULL,
  "lastInterestAccrualDateKey" text NOT NULL,
  "lateFeesAccrued" integer NOT NULL DEFAULT 0,
  "missedPaymentDays" integer NOT NULL DEFAULT 0,
  "version" integer NOT NULL DEFAULT 1,
  "issuedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "LoanRepayment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "loanId" uuid NOT NULL REFERENCES "CharacterLoan"("id") ON DELETE CASCADE,
  "characterId" uuid NOT NULL REFERENCES "Character"("id") ON DELETE CASCADE,
  "amountPaid" integer NOT NULL,
  "appliedFees" integer NOT NULL DEFAULT 0,
  "appliedInterest" integer NOT NULL DEFAULT 0,
  "appliedPrincipal" integer NOT NULL DEFAULT 0,
  "paymentSource" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "LoanOperation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotencyKey" text NOT NULL UNIQUE,
  "operationType" text NOT NULL,
  "responseJson" text NOT NULL,
  "characterId" uuid NOT NULL REFERENCES "Character"("id") ON DELETE CASCADE,
  "loanId" uuid NULL REFERENCES "CharacterLoan"("id") ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "idx_character_userId" ON "Character" ("userId");
CREATE INDEX IF NOT EXISTS "idx_stockhistory_stock_ts" ON "StockHistory" ("stockId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_portfolio_character" ON "PortfolioItem" ("characterId");
CREATE INDEX IF NOT EXISTS "idx_building_town" ON "BuildingState" ("townId");
CREATE INDEX IF NOT EXISTS "idx_building_owner" ON "BuildingState" ("ownerId");
CREATE INDEX IF NOT EXISTS "idx_loan_character_status" ON "CharacterLoan" ("characterId", "status");
CREATE INDEX IF NOT EXISTS "idx_loan_town_status" ON "CharacterLoan" ("townId", "status");
CREATE INDEX IF NOT EXISTS "idx_repayment_loan_created" ON "LoanRepayment" ("loanId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_ledger_town_created" ON "TreasuryLedgerEntry" ("townId", "createdAt" DESC);

-- Ensure required base town for loan/treasury logic
INSERT INTO "Town" ("id", "name", "bankBalance")
VALUES (1, 'BoozedBunnyTown', 1000000)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
